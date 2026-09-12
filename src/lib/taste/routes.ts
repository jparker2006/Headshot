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
import {
  crawlLetterboxd,
  crawlToInputs,
  isFreshCrawl,
  isValidUsername,
  probeLetterboxd,
  type CrawlDeps,
} from "./letterboxdCrawl";
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
import { isValidScore } from "./score";
import { notesFromEpisodes } from "@/lib/memory/rows";

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
  /**
   * What the Letterboxd crawl talks to the world with (`fetch`, and in tests a
   * fake clock). Absent in tests that do not exercise the crawl: the import
   * route then answers 503 rather than reaching for a global `fetch`.
   */
  crawl?: CrawlDeps;
}

/** Longest pinned block the Edit control accepts. */
export const MAX_PINNED_CHARS = 2000;

/**
 * What one log write says (SPEC v5): a score of 1–10, or a state with no
 * score. `{ score }` alone means `rated`; `{ state: "want" | "seen" |
 * "unseen" }` says the other three things a row can be.
 */
type LogWrite = { rating: WatchedRating; score: number | null };

const LOG_STATES = ["want", "seen", "unseen"] as const;

/**
 * The body's rating, in the only vocabulary v5 has: a `score` of 1–10, or a
 * `state` of want / seen / unseen. An old bucket word ("liked", "meh") is not
 * translated any more — it is simply not a rating, and the caller answers 400.
 */
function parseLogWrite(body: { score?: unknown; state?: unknown }): LogWrite | null {
  if (body.score !== undefined) return isValidScore(body.score) ? { rating: "rated", score: body.score } : null;
  if (typeof body.state === "string") return (LOG_STATES as readonly string[]).includes(body.state) ? { rating: body.state as WatchedRating, score: null } : null;
  return null;
}

/** How a written row reads back in the episode line. */
function logEpisodeVerb(write: LogWrite): string {
  switch (write.rating) {
    case "rated":
      return `rated`;
    case "want":
      return "want";
    case "seen":
      return "seen";
    default:
      return "never seen";
  }
}

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

/**
 * What the crawl writes into the log. The `crawls` row has nowhere to keep
 * "this was not everything" without a migration, so the episode carries it:
 * Letterboxd serves a server only the first page of films and the diary, and
 * the line says so rather than letting 96 of 2,577 look like the whole life.
 */
export function crawlEpisodeText(username: string, imported: number, partial: boolean, total: number | null): string {
  const of = total !== null && total > imported ? ` of ~${total.toLocaleString("en-US")}` : "";
  const head = `imported ${imported}${of} titles from Letterboxd (@${username})`;
  return partial ? `${head}; letterboxd only shows the recent pages` : head;
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
      return Response.json({
        markdown: row?.markdown ?? "",
        pinned: row?.pinned ?? "",
        // SPEC v5.2: titles the last rewrite removed because the log no longer
        // has them. You shows the line once and then dismisses it.
        dropped: row?.dropped ?? [],
        updatedAt: row?.updatedAt ?? null,
      });
    },

    /**
     * PUT /api/taste/memory { pinned } — the Edit control. A user's edit lands
     * in `pinned`, never in the markdown: the rewrite owns its own prose and
     * re-attaches these lines verbatim.
     */
    async putMemory(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      let body: { pinned?: unknown; dismissDropped?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return badRequest("Invalid JSON");
      }
      // The "no longer in your log" line, dismissed. Its own shape, so
      // dismissing never touches the pinned block.
      if (body.dismissDropped === true) {
        const store = await deps.store();
        await store.setMemory(who.userId, { dropped: [] });
        return Response.json({ ok: true });
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
     * POST /api/taste/import/letterboxd { username, force? } — the v5 import:
     * you type your username and your history appears (SPEC v5, story 75).
     *
     * Page one is fetched *inside* the request, so the two answers a human can
     * act on come back immediately: a private profile (200 `{ private: true }`,
     * and the UI offers the CSV) and an unknown user (404). Everything else is
     * a promise: a `running` crawl row, the walk scheduled behind `waitUntil`,
     * and 202. The Log page polls the GET below until the row says `done`.
     *
     * A username crawled successfully in the last 24 hours is not crawled
     * again without `force`: it is someone else's server.
     */
    async startLetterboxdCrawl(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      let body: { username?: unknown; force?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return badRequest("Invalid JSON");
      }
      const username = typeof body.username === "string" ? body.username.trim().replace(/^@/, "") : "";
      if (!isValidUsername(username)) return badRequest("invalid_username");
      if (!deps.crawl) return Response.json({ error: "crawl_unavailable" }, { status: 503 });
      const crawl = deps.crawl;
      const now = () => crawl.now?.() ?? new Date();

      const store = await deps.store();
      const previous = await store.getCrawl(who.userId, "letterboxd");
      if (body.force !== true && isFreshCrawl(previous, username, now())) {
        return Response.json({ cached: true, username: previous!.username, finishedAt: previous!.finishedAt, imported: previous!.imported });
      }

      let probe;
      try {
        probe = await probeLetterboxd(username, crawl);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await store.finishCrawl(who.userId, "letterboxd", { username, status: "failed", error: message });
        return Response.json({ error: "letterboxd_unavailable" }, { status: 502 });
      }
      if ("blocked" in probe) {
        // Letterboxd refused a server, which is not the user's fault and not
        // something waiting fixes: fail fast and offer the CSV.
        await store.finishCrawl(who.userId, "letterboxd", { username, status: "failed", error: "blocked" });
        return Response.json({ error: "letterboxd_unavailable" }, { status: 502 });
      }
      if ("private" in probe) {
        await store.finishCrawl(who.userId, "letterboxd", { username, status: "private" });
        return Response.json({ private: true, username });
      }
      if ("notFound" in probe) {
        await store.finishCrawl(who.userId, "letterboxd", { username, status: "not_found" });
        return Response.json({ error: "not_found", username }, { status: 404 });
      }

      await store.startCrawl(who.userId, "letterboxd", username);
      schedule(async () => {
        try {
          const result = await crawlLetterboxd(username, crawl);
          if ("private" in result) {
            await store.finishCrawl(who.userId, "letterboxd", { username, status: "private" });
            return;
          }
          if ("notFound" in result) {
            await store.finishCrawl(who.userId, "letterboxd", { username, status: "not_found" });
            return;
          }
          if ("blocked" in result) {
            await store.finishCrawl(who.userId, "letterboxd", { username, status: "failed", error: "blocked" });
            return;
          }
          const graph = await deps.graph();
          const { inputs } = crawlToInputs(graph, result.rows);
          await store.replaceImport(who.userId, "letterboxd", inputs);
          warmTitles(inputs.map((r) => r.titleImdbId), graph);
          await store.addEpisodes(who.userId, [
            { kind: "log", titleImdbId: null, text: crawlEpisodeText(username, inputs.length, result.partial, result.total) },
          ]);
          await store.finishCrawl(who.userId, "letterboxd", { username, status: "done", imported: inputs.length });
          // New evidence, so the profile is rewritten — after the rows land,
          // never before, or the memory would describe the old log.
          if (deps.rewrite) await deps.rewrite(who.userId);
        } catch (err) {
          await store.finishCrawl(who.userId, "letterboxd", {
            username,
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

      return Response.json({ started: true, username }, { status: 202 });
    },

    /**
     * GET /api/taste/import/letterboxd — how the last crawl went, which is what
     * the Log page's "importing from Letterboxd…" line watches. `idle` means
     * this user has never asked for one.
     */
    async letterboxdCrawlStatus(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      const store = await deps.store();
      const row = await store.getCrawl(who.userId, "letterboxd");
      if (!row) return Response.json({ status: "idle" });
      return Response.json({
        status: row.status,
        username: row.username,
        imported: row.imported,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        ...(row.status === "failed" && row.error ? { error: row.error } : {}),
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
     * `{ imdbId, score?, state?, season?, text? }` writes the row (source
     * "log") and one episode: a `score` of 1–10 is a rating, `state` is one of
     * want / seen / unseen. The optional line is stored verbatim inside the
     * episode text; nothing is paraphrased on the way in. `season` moves the
     * series pointer, which is how the drawer edits it.
     */
    async log(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      let body: { query?: unknown; imdbId?: unknown; score?: unknown; state?: unknown; season?: unknown; text?: unknown };
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
      const write = parseLogWrite(body);
      if (!write) return badRequest("score must be an integer 1-10, or state one of want, seen, unseen");
      const season = typeof body.season === "number" && body.season > 0 ? Math.trunc(body.season) : null;
      const line = typeof body.text === "string" ? body.text.trim() : "";

      const [store, graph] = await Promise.all([deps.store(), deps.graph()]);
      const cached = deps.titles ? await (await deps.titles()).getMany([imdbId]) : new Map<string, TitleRow>();
      const node = graph.nodeByImdbId(imdbId);
      const name = cached.get(imdbId)?.name ?? node?.name ?? imdbId;
      const year = cached.get(imdbId)?.year ?? (node?.year || null);

      // Logging a title again without a line keeps the last thing they said
      // about it; a new line replaces it (SPEC v5.2).
      const kept = line || notesFromEpisodes((await store.listEpisodes(who.userId, { limit: 200 })).filter((e) => e.titleImdbId === imdbId)).get(imdbId) || "";

      const at = new Date().toISOString();
      await store.upsertWatched(who.userId, [{ titleImdbId: imdbId, ...write, source: "log", watchedAt: at, season }]);
      await store.addEpisodes(who.userId, [
        {
          kind: "log",
          titleImdbId: imdbId,
          // "rated Heat (1995) 8/10: "the diner scene"" — the score is the
          // point of the line, so it reads the way they said it.
          text: `${logEpisodeVerb(write)} ${name}${year ? ` (${year})` : ""}${write.score != null ? ` ${write.score}/10` : ""}${kept ? `: "${kept}"` : ""}`,
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
     * DELETE /api/taste/log { imdbId } — remove a title from the log
     * (SPEC v5.2). The row goes, its logging episodes for that title go with
     * it (they are what the note is kept in, and the note is about a row that
     * no longer exists), and the memory is rewritten so the prose stops naming
     * it. What they said about their taste in general is untouched.
     */
    async deleteLog(req: Request): Promise<Response> {
      const who = await withUser(req);
      if ("response" in who) return who.response;
      let body: { imdbId?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return badRequest("Invalid JSON");
      }
      const imdbId = typeof body.imdbId === "string" ? body.imdbId : "";
      if (!/^tt\d+$/.test(imdbId)) return badRequest("imdbId required");

      const store = await deps.store();
      await store.deleteWatched(who.userId, imdbId);
      await store.deleteEpisodes(who.userId, { titleImdbId: imdbId, kinds: ["log", "chat"] });
      rewriteMemory(who.userId);
      return Response.json({ ok: true });
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
            // A corrected row keeps the state and score it already had; a row
            // that never matched takes what the client says, and failing that
            // lands in `seen` — watched, no opinion, no number invented.
            ...(prev
              ? { rating: prev.rating, score: prev.score }
              : fix.rating
                ? { rating: fix.rating, score: fix.score ?? null }
                : { rating: "seen" as WatchedRating, score: null }),
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

      // The note the user typed rides in its `log` or `chat` episode, quoted at
      // the end of the line ("rated Heat (1995) 8/10: "…""). Newest first, and
      // the latest *quoted* line stands: logging again without one keeps it.
      const notes = notesFromEpisodes(await store.listEpisodes(who.userId, { limit: 500 }));

      const data = computeNumbers({ watched, titles, graph, notes });
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
