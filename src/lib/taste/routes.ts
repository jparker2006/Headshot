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
import { matchImdb, parseImdb, toImdbInputs, type ImdbRow } from "./imdb";
import {
  matchNetflix,
  parseNetflix,
  toNetflixInputs,
  worstNetflixMatches,
  type NetflixMatch,
  type NetflixRow,
} from "./netflix";
import { computeNumbers, roleFromDepartment, type NumbersGraph, type NumbersPerson } from "./numbers";
import { normalizeProviderIds, PROVIDERS } from "./providers";
import type { ImportSource, TasteStore, WatchedRating, WatchedRow } from "./types";
import type { NodeInfo } from "@/lib/graph/engine";
import type { TmdbClient } from "@/lib/tmdb/client";
import { getTitles, type TitleRow, type TitlesStore } from "@/lib/titles";
import { fromLegacyBucket } from "./score";

/**
 * The graph slice these routes need: name lookup, single-id resolution, and
 * (for Numbers) the credits behind a title.
 */
export interface GraphLookup extends TitleSearch, NumbersGraph {
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
   * Headshots for the people Numbers found, keyed by IMDb id. Absent in tests
   * and in keyless dev: the grid then renders initials.
   */
  faces?: (imdbIds: string[]) => Promise<Record<string, { url: string | null; knownAs?: string }>>;
  /**
   * Run background work that outlives the response (`waitUntil` on Vercel).
   * The default awaits nothing and swallows failures: warming the titles cache
   * must never fail a log or an import.
   */
  schedule?: (work: () => Promise<void>) => void;
  /**
   * Rewrite this user's memory (v4). Runs through `schedule` after anything
   * that added episodes; absent in tests that do not care about the memory.
   */
  rewrite?: (userId: string) => Promise<void>;
}

/** Longest pinned block the Edit control accepts. */
export const MAX_PINNED_CHARS = 2000;

/** The four buckets a log field offers. `unseen` is a swipe verb, not a log one. */
const LOG_RATINGS = ["liked", "meh", "want", "seen"] as const;
type LogRating = (typeof LOG_RATINGS)[number];

/** movie | series from the graph's title type. */
function kindOf(node: NodeInfo | undefined): "movie" | "series" {
  return node && (node.titleType === "tvSeries" || node.titleType === "tvMiniSeries") ? "series" : "movie";
}

/** The three imports, and the label each one shows up as in an episode. */
const IMPORT_SOURCES: Record<ImportSource, string> = {
  letterboxd: "Letterboxd",
  netflix: "Netflix",
  imdb: "IMDb",
};

function isImportSource(value: unknown): value is ImportSource {
  return typeof value === "string" && value in IMPORT_SOURCES;
}

/** One correction from the worst-matches review screen. */
export interface ImportFix {
  name: string;
  year: number | null;
  /** The right title, or null to drop the row entirely ("that isn't it"). */
  imdbId: string | null;
  /**
   * The id the import actually wrote, when the client knows it. Cheaper and
   * safer than re-deriving the wrong match from (name, year), which is the
   * fallback for a client that does not send it.
   */
  from?: string | null;
  /**
   * Optional bucket for a row that had no match to inherit from. Rows that are
   * being re-pointed keep the bucket they already had.
   */
  rating?: WatchedRating;
  /** The score that goes with a `rated` fix; ignored for every other state. */
  score?: number | null;
}

const unauthorized = () => Response.json({ error: "sign_in_required" }, { status: 401 });
const badRequest = (message: string) => Response.json({ error: message }, { status: 400 });

/** What one upload turned out to be: Letterboxd's several CSVs, or one file. */
type ImportPayload =
  | { source: "letterboxd"; files: LetterboxdFiles }
  | { source: "netflix" | "imdb"; text: string };

const FILE_FIELDS = ["ratings", "watched", "watchlist", "diary", "file", "text", "netflix", "imdb"] as const;

/** Every text-ish field of the upload, whether it arrived as multipart or JSON. */
async function readFields(req: Request): Promise<Record<string, string> | null> {
  const fields: Record<string, string> = {};
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    for (const key of [...FILE_FIELDS, "source"] as const) {
      const value = form.get(key);
      if (typeof value === "string") fields[key] = value;
      else if (value && typeof (value as File).text === "function") fields[key] = await (value as File).text();
    }
    return fields;
  }
  try {
    const body = (await req.json()) as Record<string, unknown>;
    for (const key of [...FILE_FIELDS, "source"] as const) {
      if (typeof body[key] === "string") fields[key] = body[key] as string;
    }
    return fields;
  } catch {
    return null;
  }
}

/**
 * Which import this upload is. `source` decides when the client says so, and
 * Letterboxd is the default because its export has no such field and its file
 * names are the ones the original upload form posts. IMDb's export is also
 * called `ratings.csv`, which is exactly why `source` exists.
 */
async function readImport(req: Request): Promise<ImportPayload | "invalid" | "empty"> {
  const fields = await readFields(req);
  if (!fields) return "invalid";
  const source: ImportSource = isImportSource(fields.source) ? fields.source : "letterboxd";

  if (source === "letterboxd") {
    const files: LetterboxdFiles = {};
    for (const key of ["ratings", "watched", "watchlist", "diary"] as const) {
      if (fields[key]) files[key] = fields[key];
    }
    return Object.keys(files).length === 0 ? "empty" : { source, files };
  }

  const text = fields[source] ?? fields.file ?? fields.text ?? fields.ratings ?? "";
  return text.trim() ? { source, text } : "empty";
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

/** The same shape for a Netflix row, which has no year and no rating. */
function netflixReviewItem(m: NetflixMatch) {
  return {
    name: m.row.title,
    year: null,
    rating: null,
    list: "watched" as const,
    imdbId: m.imdbId,
    matchedName: m.name,
    matchedYear: m.year,
    confidence: m.confidence,
    episodes: m.row.episodes,
    season: m.row.season,
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

  /** Queue the memory rewrite for this user, if one is wired up. */
  function rewriteMemory(userId: string): void {
    if (!deps.rewrite) return;
    schedule(() => deps.rewrite!(userId));
  }

  /** Resolve the user or hand back the 401 the caller should return. */
  async function withUser(req: Request): Promise<{ userId: string } | { response: Response }> {
    const userId = await deps.userId(req);
    return userId ? { userId } : { response: unauthorized() };
  }

  return {
    /**
     * GET /api/taste/memory — the prose profile at the top of You: what the
     * rewrite job wrote, plus the lines the user pinned themselves.
     */
    async getMemory(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      const store = await deps.store();
      const row = await store.getMemory(who.userId);
      return Response.json({ markdown: row?.markdown ?? "", pinned: row?.pinned ?? "", updatedAt: row?.updatedAt ?? null });
    },

    /**
     * PUT /api/taste/memory { pinned } — the Edit control. A user's edit lands
     * in `pinned`, never in the markdown: the rewrite owns its own prose and
     * re-attaches these lines verbatim.
     */
    async putMemory(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      let body: { pinned?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return badRequest("Invalid JSON");
      }
      if (typeof body.pinned !== "string") return badRequest("pinned required");
      if (body.pinned.length > MAX_PINNED_CHARS) return badRequest(`pinned must be ${MAX_PINNED_CHARS} characters or fewer`);
      const store = await deps.store();
      await store.setMemory(who.userId, { pinned: body.pinned });
      return Response.json({ ok: true });
    },

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
     * POST /api/taste/import — parse, match, and store, for all three imports
     * (SPEC v4). Re-upload replaces per source: every previous row of *this*
     * source is dropped first, so an import is the whole truth of what that
     * service knows and a Netflix upload never disturbs Letterboxd.
     *
     * The body is either Letterboxd's CSVs (`ratings` / `watched` /
     * `watchlist` / `diary`) or `{ source, file }` — multipart or JSON, the
     * same fields either way.
     */
    async importCsv(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      const payload = await readImport(req);
      if (payload === "invalid") return badRequest("Invalid JSON");
      if (payload === "empty") return badRequest("no CSV files in the upload");

      const [store, graph] = await Promise.all([deps.store(), deps.graph()]);

      let parsed = 0;
      let ids: string[] = [];
      let unmatched: { name: string; year: number | null; rating?: number | null; list?: string; imdbId?: string }[] = [];
      let review: ReturnType<typeof reviewItem>[] | ReturnType<typeof netflixReviewItem>[] = [];

      if (payload.source === "letterboxd") {
        const rows = parseLetterboxd(payload.files);
        const result = matchToGraph(graph, rows);
        parsed = rows.length;
        ids = result.matched.map((m) => m.imdbId);
        unmatched = result.unmatched.map((r: LetterboxdRow) => ({ name: r.name, year: r.year, rating: r.rating, list: r.list }));
        review = worstMatches(result.matched).map(reviewItem);
        await store.replaceImport(who.userId, "letterboxd", toWatchedInputs(result.matched));
      } else if (payload.source === "netflix") {
        const rows = parseNetflix(payload.text);
        const result = matchNetflix(graph, rows);
        parsed = rows.length;
        ids = result.matched.map((m) => m.imdbId);
        unmatched = result.unmatched.map((r: NetflixRow) => ({ name: r.title, year: null }));
        review = worstNetflixMatches(result.matched).map(netflixReviewItem);
        await store.replaceImport(who.userId, "netflix", toNetflixInputs(result.matched));
      } else {
        const rows = parseImdb(payload.text);
        const result = matchImdb(graph, rows);
        parsed = rows.length;
        ids = result.matched.map((m) => m.imdbId);
        // Matched by id, so there is nothing for a human to second-guess; the
        // ids the graph lacks are reported and dropped, never guessed by name.
        unmatched = result.skipped.map((r: ImdbRow) => ({ name: r.name, year: r.year, imdbId: r.imdbId }));
        await store.replaceImport(who.userId, "imdb", toImdbInputs(result.matched));
      }

      warmTitles(ids, graph);
      await store.addEpisodes(who.userId, [
        { kind: "log", titleImdbId: null, text: `imported ${ids.length} titles from ${IMPORT_SOURCES[payload.source]}` },
      ]);
      // New evidence: the memory is rewritten after the response has gone out.
      rewriteMemory(who.userId);

      return Response.json({
        source: payload.source,
        parsed,
        imported: ids.length,
        skipped: unmatched.length,
        unmatched,
        review,
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
        // The log field still offers the old four words; the store wants a
        // state plus a score, so the bucket is translated on the way in.
        { titleImdbId: imdbId, ...fromLegacyBucket(rating), source: "log", watchedAt: at, season },
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
      // New evidence: the memory is rewritten after the response has gone out.
      rewriteMemory(who.userId);

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
      let body: { fixes?: unknown; source?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return badRequest("Invalid JSON");
      }
      const fixes = Array.isArray(body.fixes) ? (body.fixes as ImportFix[]) : null;
      if (!fixes) return badRequest("fixes required");
      const source: ImportSource = isImportSource(body.source) ? body.source : "letterboxd";

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
        const wrongId =
          (typeof fix.from === "string" ? fix.from : null) ??
          (source === "netflix"
            ? (matchNetflix(graph, [{ title: fix.name, date: null, series: false, episodes: 0, season: null }]).matched[0]?.imdbId ?? null)
            : (matchToGraph(graph, [probe]).matched[0]?.imdbId ?? null));
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
            ...(prev
              ? { rating: prev.rating, score: prev.score }
              : fix.rating
                ? { rating: fix.rating, score: fix.score ?? null }
                : fromLegacyBucket(source === "netflix" ? "seen" : "meh")),
            source,
            watchedAt: prev?.watchedAt ?? null,
            season: prev?.season ?? null,
            episodesWatched: prev?.episodesWatched ?? 0,
          },
        ]);
        corrected++;
      }

      return Response.json({ corrected, dropped, watched: await store.listWatched(who.userId) });
    },

    /**
     * GET /api/taste/numbers — everything the Numbers page draws, computed.
     *
     * The response never waits on TMDB: the titles cache answers with whatever
     * it has (plus the graph's name/year/kind for a row it has never seen), and
     * the rows that are missing runtime, genres or a poster are warmed after
     * the response, so the second visit is complete. Faces are the one network
     * call, and only for the twelve people the grid shows.
     */
    async numbers(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      const [store, graph] = await Promise.all([deps.store(), deps.graph()]);
      const watched = await store.listWatched(who.userId);
      const ids = watched.map((r) => r.titleImdbId);

      let titles = new Map<string, TitleRow>();
      if (deps.titles && ids.length) {
        const titlesStore = await deps.titles();
        // tmdb null: cached rows come back as they are and a miss is filled
        // from the graph alone, in process. The TMDB half is the warm below.
        titles = await getTitles(ids, { store: titlesStore, tmdb: null, graph });
        warmTitles(
          ids.filter((id) => !titles.get(id)?.fetchedAt),
          graph,
        );
      }

      const data = computeNumbers({ watched, titles, graph });
      let people: (NumbersPerson & { face: string | null })[] = data.people.map((p) => ({ ...p, face: null }));
      if (deps.faces && people.length) {
        const faces = await deps.faces(people.map((p) => p.imdbId)).catch((): Record<string, { url: string | null; knownAs?: string }> => ({}));
        people = people.map((p) => {
          const hit = faces[p.imdbId];
          return { ...p, face: hit?.url ?? null, role: roleFromDepartment(hit?.knownAs) ?? p.role };
        });
      }

      return Response.json({ ...data, people }, { headers: { "cache-control": "no-store" } });
    },
  };
}
