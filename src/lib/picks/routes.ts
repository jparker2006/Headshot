/**
 * Tonight's routes as a factory over their dependencies (the same seam the
 * chat and taste routes use). Everything is behind sign-in with a 401.
 */
import type { LanguageModel } from "ai";
import type { IndustryGraph } from "@/lib/graph/engine";
import type { TmdbClient } from "@/lib/tmdb/client";
import type { TasteStore } from "@/lib/taste/types";
import type { TitlesStore } from "@/lib/titles";
import type { Filters } from "./engine";
import { computeTonight, loadTonight } from "./service";
import { deckSource, parseDeckSize } from "./deckSource";
import { diffLines, type MemoryDiff } from "./sessionDiff";
import { memoryText } from "@/lib/memory";
import { tasteMap } from "@/lib/taste/map";
import { tasteFacts } from "./engine";
import { toEngineRows } from "./service";

export interface TonightRouteDeps {
  userId: (req: Request) => Promise<string | null>;
  store: () => Promise<TasteStore>;
  graph: () => Promise<IndustryGraph>;
  tmdb: () => TmdbClient | null;
  titles?: () => Promise<TitlesStore>;
  /** Background work that outlives the response (`waitUntil` on Vercel). */
  schedule?: (work: () => Promise<void>) => void;
  model?: () => LanguageModel | null;
  log?: (m: string) => void;
  /** Rewrite this user's memory (v4), scheduled after a swipe episode. */
  rewrite?: (userId: string) => Promise<void>;
  /**
   * Rewrite this user's memory now and hand back the new markdown (null when
   * the model is unavailable or the rewrite was skipped). The swipe-session
   * route awaits this instead of scheduling `rewrite`: the diff is the point
   * of the screen, so it cannot happen after the response.
   */
  rewriteNow?: (userId: string) => Promise<string | null>;
}

const unauthorized = () => Response.json({ error: "sign_in_required" }, { status: 401 });

function parseFilters(body: Record<string, unknown>): Filters {
  const f: Filters = {};
  if (typeof body.maxRuntimeMin === "number" && body.maxRuntimeMin > 0) f.maxRuntimeMin = body.maxRuntimeMin;
  if (body.energy === "light" || body.energy === "heavy" || body.energy === "any") f.energy = body.energy;
  return f;
}

/** The ratings a swipe can commit; `unseen` is a removal, handled by the store. */
type SwipeRating = "liked" | "meh" | "unseen" | "want";

/** The rows a swipe body actually carries, junk dropped. */
function parseSwipeRows(rows: unknown[]): { titleImdbId: string; rating: SwipeRating; source: "swipe" }[] {
  return rows
    .filter((r): r is { imdbId: string; rating: SwipeRating } => {
      const x = r as Record<string, unknown>;
      return typeof x.imdbId === "string" && /^tt\d+$/.test(x.imdbId) && ["liked", "meh", "unseen", "want"].includes(String(x.rating));
    })
    .map((r) => ({ titleImdbId: r.imdbId, rating: r.rating, source: "swipe" as const }));
}

/** One episode per session, not per card: "swiped: liked X, Y; meh Z". */
function swipeEpisodeText(graph: IndustryGraph, rows: { titleImdbId: string; rating: SwipeRating }[]): string {
  const name = (id: string) => graph.nodeByImdbId(id)?.name ?? id;
  const parts = ([["liked", "liked"], ["meh", "meh"], ["seen", "seen but no opinion"], ["unseen", "never seen"], ["want", "want"]] as const)
    .map(([rating, label]) => {
      const names = rows.filter((r) => r.rating === rating).map((r) => name(r.titleImdbId));
      return names.length ? `${label} ${names.join(", ")}` : "";
    })
    .filter(Boolean);
  return `swiped: ${parts.join("; ")}`.slice(0, 400);
}

export function createTonightHandlers(deps: TonightRouteDeps) {
  const build = async () => ({
    graph: await deps.graph(),
    tmdb: deps.tmdb(),
    store: await deps.store(),
    titles: deps.titles ? await deps.titles() : null,
    schedule: deps.schedule,
    model: deps.model?.() ?? null,
    log: deps.log,
  });
  return {
    /** GET /api/tonight — stored picks, computed once when there are none. 404 until the user has rated something. */
    async get(req: Request): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      const data = await loadTonight(await build(), userId);
      return data ? Response.json(data) : Response.json({ error: "no_taste_yet" }, { status: 404 });
    },

    /** POST /api/tonight/refresh { maxRuntimeMin?, energy? } — recompute now with tonight's filters. */
    async refresh(req: Request): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      let body: Record<string, unknown> = {};
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        body = {};
      }
      const data = await computeTonight(await build(), userId, parseFilters(body));
      return data ? Response.json(data) : Response.json({ error: "no_taste_yet" }, { status: 404 });
    },

    /**
     * GET /api/taste/deck?size= — a swipe session's cards, minus anything
     * already rated. Walked from the user's own likes once there are five of
     * them (`mode: "lore"`), the fixed onboarding deck before that ("cold").
     */
    async deck(req: Request): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      const [graph, store] = await Promise.all([deps.graph(), deps.store()]);
      const watched = await store.listWatched(userId);
      const size = parseDeckSize(new URL(req.url).searchParams.get("size"));
      return Response.json(deckSource(graph, toEngineRows(watched), { size }));
    },

    /** GET /api/taste/map — the user's private ego graph plus the derived facts for the rail. */
    async map(req: Request): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      const [graph, store] = await Promise.all([deps.graph(), deps.store()]);
      const watched = await store.listWatched(userId);
      const stored = await store.getTaste(userId);
      const facts = stored?.facts ?? tasteFacts(graph, toEngineRows(watched));
      return Response.json({ network: tasteMap(graph, watched), facts, rated: watched.filter((w) => w.rating === "liked" || w.rating === "meh").length, later: watched.filter((w) => w.rating === "want").length });
    },

    /** POST /api/taste/later { imdbId } — "not tonight": the title joins Later (bucket `want`). */
    async later(req: Request): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      let body: { imdbId?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }
      if (typeof body.imdbId !== "string" || !/^tt\d+$/.test(body.imdbId)) return Response.json({ error: "imdbId required" }, { status: 400 });
      const store = await deps.store();
      await store.upsertWatched(userId, [{ titleImdbId: body.imdbId, rating: "want", source: "swipe" }]);
      return Response.json({ ok: true });
    },

    /** POST /api/taste/swipe { rows: [{imdbId, rating}] } — the deck's committed rows (last action wins; undo is a re-post). */
    async swipe(req: Request): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      let body: { rows?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }
      if (!Array.isArray(body.rows)) return Response.json({ error: "rows required" }, { status: 400 });
      const rows = parseSwipeRows(body.rows);
      const [store, graph] = await Promise.all([deps.store(), deps.graph()]);
      await store.upsertWatched(userId, rows);
      if (rows.length) {
        await store.addEpisodes(userId, [{ kind: "swipe", text: swipeEpisodeText(graph, rows) }]);
        if (deps.rewrite) {
          const work = () => deps.rewrite!(userId);
          if (deps.schedule) deps.schedule(work);
          else void work().catch(() => {});
        }
      }
      return Response.json({ ok: true, saved: rows.length });
    },

    /**
     * POST /api/taste/swipe/session { rows } — the end of a swipe session
     * (SPEC v4, "swipe as lore"). Writes the rows and one episode like
     * `swipe`, then awaits exactly one memory rewrite — never the scheduled
     * one as well — and answers with the memory before and after plus the
     * line-wise diff the client shows before returning to You.
     *
     * A rewrite that cannot run (no model, nothing new to say) is not an
     * error: `rewritten: false`, an empty diff, and `after` equal to `before`.
     */
    async session(req: Request): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      let body: { rows?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }
      if (!Array.isArray(body.rows)) return Response.json({ error: "rows required" }, { status: 400 });
      const rows = parseSwipeRows(body.rows);
      if (!rows.length) return Response.json({ error: "no valid rows" }, { status: 400 });

      const [store, graph] = await Promise.all([deps.store(), deps.graph()]);
      const before = await memoryText(store, userId);
      await store.upsertWatched(userId, rows);
      await store.addEpisodes(userId, [{ kind: "swipe", text: swipeEpisodeText(graph, rows) }]);

      let after: string | null = null;
      if (deps.rewriteNow) {
        try {
          after = await deps.rewriteNow(userId);
        } catch (err) {
          deps.log?.(`[swipe] rewrite failed: ${err instanceof Error ? err.message : String(err)}`);
          after = null;
        }
      }
      const rewritten = typeof after === "string" && after.trim().length > 0;
      const resolved = rewritten ? after! : before;
      const diff: MemoryDiff = rewritten ? diffLines(before, resolved) : { added: [], removed: [] };
      return Response.json({ before, after: resolved, diff, rewritten });
    },
  };
}
