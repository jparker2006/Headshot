/**
 * `getTitles(ids)` — the one way anything reads title facts.
 *
 * Cached rows come back immediately. A miss is answered from the industry
 * graph (name, year, kind) in the same turn, and TMDB fills in runtime,
 * seasons, genres, poster and providers behind a small concurrency limit. A
 * TMDB failure is never fatal: the graph-only row is returned and stored with
 * `fetchedAt` null so the next caller retries.
 */
import type { NodeInfo } from "@/lib/graph/engine";
import type { TmdbClient } from "@/lib/tmdb/client";
import { fetchTitleFacts } from "./tmdb";
import { MemoryTitlesStore } from "./memory";
import type { TitleRow, TitlesStore } from "./types";

export * from "./types";
export { MemoryTitlesStore } from "./memory";
export { posterUrl, fetchTitleFacts } from "./tmdb";

/** The slice of the industry graph this module needs, so tests can pass a stub. */
export interface TitleLookup {
  nodeByImdbId(imdbId: string): NodeInfo | undefined;
}

export interface GetTitlesDeps {
  store: TitlesStore;
  /** Null when no TMDB token is configured; rows then stay graph-only. */
  tmdb: TmdbClient | null;
  graph: TitleLookup;
  region?: string;
  /** ≤5 parallel TMDB fetches by default. */
  concurrency?: number;
  /** A cached row older than this counts as stale. */
  maxAgeMs?: number;
  /**
   * Refresh stale rows too. Off by default so a read never waits on TMDB for
   * a row it already has: the warm calls (import, pick, log) pass it from
   * inside `waitUntil`, where the wait costs the user nothing.
   */
  refreshStale?: boolean;
  now?: () => Date;
  log?: (m: string) => void;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_CONCURRENCY = 5;

/** Name, year and kind from the graph alone: what a miss can answer instantly. */
function graphRow(graph: TitleLookup, imdbId: string): TitleRow {
  const node = graph.nodeByImdbId(imdbId);
  return {
    imdbId,
    tmdbId: node?.tmdbId ?? null,
    kind: node && (node.titleType === "tvSeries" || node.titleType === "tvMiniSeries") ? "series" : "movie",
    name: node?.name ?? imdbId,
    year: node?.year ? node.year : null,
    runtime: null,
    seasons: null,
    genres: node?.genres ? node.genres.split(",").filter(Boolean) : [],
    posterPath: null,
    providers: null,
    fetchedAt: null,
  };
}

/** Run `work` over `items` with at most `limit` in flight. */
async function pooled<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length) await work(items[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, worker));
}

export async function getTitles(ids: string[], deps: GetTitlesDeps): Promise<Map<string, TitleRow>> {
  const wanted = [...new Set(ids.filter((id) => /^tt\d+$/.test(id)))];
  if (wanted.length === 0) return new Map();
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});
  const maxAge = deps.maxAgeMs ?? THIRTY_DAYS_MS;

  const cached = await deps.store.getMany(wanted);
  const out = new Map<string, TitleRow>(cached);

  const stale = (row: TitleRow) =>
    !row.fetchedAt || now().getTime() - new Date(row.fetchedAt).getTime() > maxAge;
  // A miss must still answer this caller, so the graph half is filled in now
  // and the TMDB half is merged into the same object if it arrives in time.
  const misses: string[] = [];
  for (const id of wanted) {
    const hit = out.get(id);
    if (!hit) {
      out.set(id, graphRow(deps.graph, id));
      misses.push(id);
      // A row stored without a `fetchedAt` is the TMDB-failure case: retry it
      // on the next read. Age-based staleness is only chased when the caller
      // says it can afford to wait.
    } else if (!hit.fetchedAt || (deps.refreshStale && stale(hit))) {
      misses.push(id);
    }
  }
  if (misses.length === 0) return out;

  const tmdb = deps.tmdb;
  const written: TitleRow[] = [];
  if (!tmdb) {
    // No token configured: keep the graph half so names and kinds are cached,
    // with fetchedAt null so the TMDB half is filled the first time it can be.
    const rows = misses.filter((id) => !cached.has(id)).map((id) => out.get(id)!);
    try {
      await deps.store.upsertMany(rows);
    } catch (err) {
      log(`[titles] upsert failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return out;
  }

  await pooled(misses, deps.concurrency ?? DEFAULT_CONCURRENCY, async (id) => {
    const base = out.get(id)!;
    try {
      const facts = await fetchTitleFacts(tmdb, id, { region: deps.region });
      if (!facts) {
        // TMDB does not know this id. Store the graph half so the row exists,
        // with fetchedAt null: cheap to retry, never blocking.
        if (!cached.has(id)) written.push(base);
        return;
      }
      const row: TitleRow = {
        ...base,
        tmdbId: facts.tmdbId,
        kind: facts.kind,
        name: base.name && base.name !== id ? base.name : facts.name,
        year: base.year ?? facts.year,
        runtime: facts.runtime,
        seasons: facts.seasons,
        genres: facts.genres.length ? facts.genres : base.genres,
        posterPath: facts.posterPath,
        providers: facts.providers,
        fetchedAt: now().toISOString(),
      };
      out.set(id, row);
      written.push(row);
    } catch (err) {
      log(`[titles] ${id}: ${err instanceof Error ? err.message : String(err)}`);
      if (!cached.has(id)) written.push(base);
    }
  });

  try {
    await deps.store.upsertMany(written);
  } catch (err) {
    log(`[titles] upsert failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return out;
}

const g = globalThis as unknown as { __headshotTitlesStore?: Promise<TitlesStore> };

/**
 * The process-wide titles store: Postgres when DATABASE_URL is set, memory
 * otherwise — the same rule the brain and the taste store follow.
 */
export function getTitlesStore(): Promise<TitlesStore> {
  if (!g.__headshotTitlesStore) {
    g.__headshotTitlesStore = (async () => {
      if (process.env.DATABASE_URL) {
        const { PostgresTitlesStore } = await import("./postgres");
        return new PostgresTitlesStore(process.env.DATABASE_URL);
      }
      return new MemoryTitlesStore();
    })();
  }
  return g.__headshotTitlesStore;
}
