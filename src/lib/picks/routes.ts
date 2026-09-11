/**
 * Tonight's routes as a factory over their dependencies (the same seam the
 * chat and taste routes use). Everything is behind sign-in with a 401.
 */
import type { LanguageModel } from "ai";
import type { IndustryGraph } from "@/lib/graph/engine";
import type { TmdbClient } from "@/lib/tmdb/client";
import type { TasteStore } from "@/lib/taste/types";
import type { Filters } from "./engine";
import { computeTonight, loadTonight } from "./service";
import { onboardingDeck } from "./onboarding";
import { tasteMap } from "@/lib/taste/map";
import { tasteFacts } from "./engine";
import { toEngineRows } from "./service";

export interface TonightRouteDeps {
  userId: (req: Request) => Promise<string | null>;
  store: () => Promise<TasteStore>;
  graph: () => Promise<IndustryGraph>;
  tmdb: () => TmdbClient | null;
  model?: () => LanguageModel | null;
  log?: (m: string) => void;
}

const unauthorized = () => Response.json({ error: "sign_in_required" }, { status: 401 });

function parseFilters(body: Record<string, unknown>): Filters {
  const f: Filters = {};
  if (typeof body.maxRuntimeMin === "number" && body.maxRuntimeMin > 0) f.maxRuntimeMin = body.maxRuntimeMin;
  if (body.energy === "light" || body.energy === "heavy" || body.energy === "any") f.energy = body.energy;
  return f;
}

export function createTonightHandlers(deps: TonightRouteDeps) {
  const build = async () => ({ graph: await deps.graph(), tmdb: deps.tmdb(), store: await deps.store(), model: deps.model?.() ?? null, log: deps.log });
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

    /** GET /api/taste/deck — the fifty-title onboarding deck, minus anything already rated. */
    async deck(req: Request): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      const [graph, store] = await Promise.all([deps.graph(), deps.store()]);
      const rated = (await store.listWatched(userId)).map((r) => r.titleImdbId);
      return Response.json({ cards: onboardingDeck(graph, { size: 50, exclude: rated }) });
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
      const rows = body.rows
        .filter((r): r is { imdbId: string; rating: "liked" | "meh" | "unseen" | "want" } => {
          const x = r as Record<string, unknown>;
          return typeof x.imdbId === "string" && /^tt\d+$/.test(x.imdbId) && ["liked", "meh", "unseen", "want"].includes(String(x.rating));
        })
        .map((r) => ({ titleImdbId: r.imdbId, rating: r.rating, source: "swipe" as const }));
      const store = await deps.store();
      await store.upsertWatched(userId, rows);
      return Response.json({ ok: true, saved: rows.length });
    },
  };
}
