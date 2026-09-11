/**
 * The taste API, as a factory over its dependencies — the same seam
 * `createChatHandler` uses, so `tests/route/taste.test.ts` can inject a fake
 * user resolver, the fixture graph, and a memory store.
 *
 * Every handler here is behind sign-in and says so with 401 rather than a
 * redirect: Headshot's own routes stay open and anonymous (SPEC v3).
 */
import {
  matchToGraph,
  parseLetterboxd,
  toWatchedInputs,
  worstMatches,
  type LetterboxdFiles,
  type LetterboxdRow,
  type MatchedRow,
  type TitleSearch,
} from "./letterboxd";
import { normalizeProviderIds, PROVIDERS } from "./providers";
import type { TasteStore, WatchedRating, WatchedRow } from "./types";
import type { NodeInfo } from "@/lib/graph/engine";
import type { TmdbClient } from "@/lib/tmdb/client";
import { getTitles, type TitleRow, type TitlesStore } from "@/lib/titles";

/** The graph slice these routes need: name lookup plus single-id resolution. */
export interface GraphLookup extends TitleSearch {
  nodeByImdbId(imdbId: string): NodeInfo | undefined;
}

export interface TasteDeps {
  /** Resolve the signed-in user for this request, or null. */
  userId: (req: Request) => Promise<string | null>;
  store: () => Promise<TasteStore>;
  /** The industry graph, for matching imported titles. */
  graph: () => Promise<GraphLookup>;
  /** The titles cache. Absent in tests that do not care about warming. */
  titles?: () => Promise<TitlesStore>;
  tmdb?: () => TmdbClient | null;
  /**
   * Run background work that outlives the response (`waitUntil` on Vercel).
   * The default awaits nothing and swallows failures: warming the titles cache
   * must never fail a log or an import.
   */
  schedule?: (work: () => Promise<void>) => void;
}

/** The four buckets a log field offers. `unseen` is a swipe verb, not a log one. */
const LOG_RATINGS = ["liked", "meh", "want", "seen"] as const;
type LogRating = (typeof LOG_RATINGS)[number];

/** movie | series from the graph's title type. */
function kindOf(node: NodeInfo | undefined): "movie" | "series" {
  return node && (node.titleType === "tvSeries" || node.titleType === "tvMiniSeries") ? "series" : "movie";
}

/** One correction from the worst-matches review screen. */
export interface ImportFix {
  name: string;
  year: number | null;
  /** The right title, or null to drop the row entirely ("that isn't it"). */
  imdbId: string | null;
  /**
   * Optional bucket for a row that had no match to inherit from. Rows that are
   * being re-pointed keep the bucket they already had.
   */
  rating?: WatchedRating;
}

const unauthorized = () => Response.json({ error: "sign_in_required" }, { status: 401 });
const badRequest = (message: string) => Response.json({ error: message }, { status: 400 });

/** The three CSVs, from multipart form fields or from a JSON body of texts. */
async function readFiles(req: Request): Promise<LetterboxdFiles | null> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const files: LetterboxdFiles = {};
    for (const key of ["ratings", "watched", "watchlist", "diary"] as const) {
      const value = form.get(key);
      if (typeof value === "string") files[key] = value;
      else if (value && typeof (value as File).text === "function") files[key] = await (value as File).text();
    }
    return files;
  }
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const files: LetterboxdFiles = {};
    for (const key of ["ratings", "watched", "watchlist", "diary"] as const) {
      if (typeof body[key] === "string") files[key] = body[key] as string;
    }
    return files;
  } catch {
    return null;
  }
}

/** The review payload: enough for a human to say yes or fix it. */
function reviewItem(m: MatchedRow) {
  return {
    name: m.row.name,
    year: m.row.year,
    rating: m.row.rating,
    list: m.row.list,
    imdbId: m.imdbId,
    matchedName: m.name,
    matchedYear: m.year,
    confidence: m.confidence,
  };
}

export function createTasteHandlers(deps: TasteDeps) {
  const schedule =
    deps.schedule ??
    ((work: () => Promise<void>) => {
      void work().catch(() => {});
    });

  /** Fill the titles cache for these ids after the response has gone out. */
  function warmTitles(ids: string[], graph: GraphLookup): void {
    if (!deps.titles || ids.length === 0) return;
    schedule(async () => {
      const store = await deps.titles!();
      await getTitles(ids, { store, tmdb: deps.tmdb?.() ?? null, graph, refreshStale: true });
    });
  }

  /** Resolve the user or hand back the 401 the caller should return. */
  async function withUser(req: Request): Promise<{ userId: string } | { response: Response }> {
    const userId = await deps.userId(req);
    return userId ? { userId } : { response: unauthorized() };
  }

  return {
    /** GET /api/taste/watched — everything the store holds for this user. */
    async listWatched(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      const store = await deps.store();
      return Response.json({ watched: await store.listWatched(who.userId) });
    },

    /** GET /api/taste/services — the checklist plus what the user has chosen. */
    async getServices(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      const store = await deps.store();
      const row = await store.getServices(who.userId);
      return Response.json({
        providers: PROVIDERS,
        providerIds: row?.providerIds ?? [],
        region: row?.region ?? "US",
      });
    },

    /** PUT /api/taste/services — replace the checklist selection. */
    async putServices(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      let body: { providerIds?: unknown; region?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return badRequest("Invalid JSON");
      }
      if (!Array.isArray(body.providerIds)) return badRequest("providerIds required");
      const providerIds = normalizeProviderIds(body.providerIds.filter((n): n is number => typeof n === "number"));
      const region = typeof body.region === "string" && body.region.length === 2 ? body.region.toUpperCase() : "US";
      const store = await deps.store();
      const row = await store.setServices(who.userId, { providerIds, region });
      return Response.json(row);
    },

    /**
     * POST /api/taste/import — parse, match, and store. Re-upload replaces:
     * every previous `letterboxd` row is dropped first, so the import is the
     * whole truth of what Letterboxd knows and nothing accumulates.
     */
    async importLetterboxd(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      const files = await readFiles(req);
      if (!files) return badRequest("Invalid JSON");
      if (!files.ratings && !files.watched && !files.watchlist && !files.diary) {
        return badRequest("no CSV files in the upload");
      }

      const [store, graph] = await Promise.all([deps.store(), deps.graph()]);
      const rows = parseLetterboxd(files);
      const { matched, unmatched } = matchToGraph(graph, rows);
      await store.replaceImport(who.userId, "letterboxd", toWatchedInputs(matched));
      warmTitles(matched.map((m) => m.imdbId), graph);

      return Response.json({
        parsed: rows.length,
        imported: matched.length,
        unmatched: unmatched.map((r: LetterboxdRow) => ({ name: r.name, year: r.year, rating: r.rating, list: r.list })),
        review: worstMatches(matched).map(reviewItem),
      });
    },

    /**
     * POST /api/taste/log — the one field at the top of You, in two shapes.
     *
     * `{ query }` resolves what the user is typing to candidates (the same
     * name lookup the search route and `find_entities` use), with a series'
     * seasons attached when the titles cache already holds them — never a
     * TMDB round trip, because this runs on every keystroke.
     *
     * `{ imdbId, rating, season?, text? }` writes the row (source "log") and
     * one episode. The optional line is stored verbatim inside the episode
     * text; nothing is paraphrased on the way in.
     */
    async log(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      let body: { query?: unknown; imdbId?: unknown; rating?: unknown; season?: unknown; text?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return badRequest("Invalid JSON");
      }

      if (typeof body.query === "string") {
        const query = body.query.trim();
        if (query.length < 2) return Response.json({ candidates: [] });
        const graph = await deps.graph();
        const hits = graph.searchByName(query, 6, "title");
        const cached = deps.titles ? await (await deps.titles()).getMany(hits.map((h) => h.imdbId)) : new Map<string, TitleRow>();
        return Response.json({
          candidates: hits.map((h) => {
            const row = cached.get(h.imdbId);
            const kind = row?.kind ?? kindOf(h);
            return {
              imdbId: h.imdbId,
              name: h.name,
              year: h.year || null,
              kind,
              seasons: kind === "series" ? (row?.seasons ?? null) : null,
            };
          }),
        });
      }

      const imdbId = typeof body.imdbId === "string" ? body.imdbId : "";
      if (!/^tt\d+$/.test(imdbId)) return badRequest("query or imdbId required");
      const rating = String(body.rating) as LogRating;
      if (!LOG_RATINGS.includes(rating)) return badRequest("rating must be liked, meh, want or seen");
      const season = typeof body.season === "number" && body.season > 0 ? Math.trunc(body.season) : null;
      const line = typeof body.text === "string" ? body.text.trim() : "";

      const [store, graph] = await Promise.all([deps.store(), deps.graph()]);
      const cached = deps.titles ? await (await deps.titles()).getMany([imdbId]) : new Map<string, TitleRow>();
      const node = graph.nodeByImdbId(imdbId);
      const name = cached.get(imdbId)?.name ?? node?.name ?? imdbId;
      const year = cached.get(imdbId)?.year ?? (node?.year || null);

      const at = new Date().toISOString();
      await store.upsertWatched(who.userId, [
        { titleImdbId: imdbId, rating, source: "log", watchedAt: at, season },
      ]);
      await store.addEpisodes(who.userId, [
        {
          kind: "log",
          titleImdbId: imdbId,
          text: `${rating} ${name}${year ? ` (${year})` : ""}${line ? `: "${line}"` : ""}`,
          at,
        },
      ]);
      warmTitles([imdbId], graph);

      const row = (await store.listWatched(who.userId)).find((r) => r.titleImdbId === imdbId) as WatchedRow;
      return Response.json({ ok: true, row });
    },

    /**
     * POST /api/taste/import/confirm — apply the review screen's corrections.
     * A fix names the row by (name, year), so the wrong match is re-derived
     * the same way it was made, then replaced or dropped.
     */
    async confirmImport(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      let body: { fixes?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return badRequest("Invalid JSON");
      }
      const fixes = Array.isArray(body.fixes) ? (body.fixes as ImportFix[]) : null;
      if (!fixes) return badRequest("fixes required");

      const [store, graph] = await Promise.all([deps.store(), deps.graph()]);
      const existing = new Map((await store.listWatched(who.userId)).map((r) => [r.titleImdbId, r]));

      let corrected = 0;
      let dropped = 0;
      for (const fix of fixes) {
        if (!fix || typeof fix.name !== "string") continue;
        const probe: LetterboxdRow = {
          name: fix.name,
          year: typeof fix.year === "number" ? fix.year : null,
          rating: null,
          watchedAt: null,
          list: "watched",
        };
        const wrongId = matchToGraph(graph, [probe]).matched[0]?.imdbId ?? null;
        const prev = wrongId ? existing.get(wrongId) : undefined;

        if (wrongId && wrongId !== fix.imdbId) {
          await store.deleteWatched(who.userId, wrongId);
          existing.delete(wrongId);
          if (!fix.imdbId) dropped++;
        }
        if (!fix.imdbId) continue;
        await store.upsertWatched(who.userId, [
          {
            titleImdbId: fix.imdbId,
            // The corrected row keeps the bucket it already had; only a row
            // that never matched needs the client to say which bucket it is.
            rating: prev?.rating ?? fix.rating ?? "meh",
            source: "letterboxd",
            watchedAt: prev?.watchedAt ?? null,
          },
        ]);
        corrected++;
      }

      return Response.json({ corrected, dropped, watched: await store.listWatched(who.userId) });
    },
  };
}
