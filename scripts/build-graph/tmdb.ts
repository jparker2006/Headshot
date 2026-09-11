/**
 * Stage two of the offline pipeline: crawl TMDB credits for the top titles by
 * IMDb votes so the graph gets full casts (guest and recurring, not just the
 * four IMDb principals) plus character names.
 *
 * Every response is cached on disk under `<cacheDir>/titles/<tt>.json` and
 * `<cacheDir>/people/<tmdbId>.json`, so a rerun is free and completely
 * offline. `loadCachedCredits` reads a finished cache without any network at
 * all — that is what the fixture build and the tests use.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = "https://api.themoviedb.org/3";

/** One cast member on a title, as we keep it. */
export interface CachedCastMember {
  tmdbId: number;
  name: string;
  character: string;
  /** Billing order; lower is more prominent. */
  order: number;
  /** IMDb id when TMDB knows one (or the IMDb graph resolved it by name). */
  imdbId: string | null;
}

/** Credits for one title, as cached on disk. */
export interface CachedCredits {
  imdbId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  cast: CachedCastMember[];
}

/** Cache entry for a title TMDB does not have. */
interface CachedMiss {
  imdbId: string;
  missing: true;
}

export interface CrawlTitle {
  imdbId: string;
  titleType: string;
}

export interface CrawlOptions {
  titles: CrawlTitle[];
  cacheDir: string;
  token: string;
  concurrency?: number;
  /**
   * Per title, a lowercased-name → nconst map of people already adjacent to it
   * in the IMDb graph. A cast member whose name matches is resolved from here,
   * which saves an /external_ids call per person.
   */
  knownPeople?: Map<string, Map<string, string>>;
  log?: (m: string) => void;
}

/** Cast members kept per title, by TMDB billing order. */
export const CAST_CAP = 40;

const DEFAULT_CONCURRENCY = 20;
const MAX_ATTEMPTS = 3;
/** How many times one request will wait out a 429 before giving up. */
const MAX_429_WAITS = 20;

// ---- cache -----------------------------------------------------------------

function titleCachePath(cacheDir: string, imdbId: string): string {
  return path.join(cacheDir, "titles", `${imdbId}.json`);
}
function personCachePath(cacheDir: string, tmdbId: number): string {
  return path.join(cacheDir, "people", `${tmdbId}.json`);
}

function readJson<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value));
}

/**
 * Read a finished credits cache with no network access at all. Missing-title
 * markers are skipped. Keyed by IMDb title id.
 */
export function loadCachedCredits(cacheDir: string): Map<string, CachedCredits> {
  const out = new Map<string, CachedCredits>();
  const dir = path.join(cacheDir, "titles");
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".json")) continue;
    const entry = readJson<CachedCredits | CachedMiss>(path.join(dir, file));
    if (!entry || "missing" in entry) continue;
    out.set(entry.imdbId, entry);
  }
  return out;
}

// ---- env -------------------------------------------------------------------

/** TMDB bearer token from the environment, falling back to .env.local. */
export function tmdbTokenFromEnv(): string | undefined {
  if (process.env.TMDB_BEARER_TOKEN) return process.env.TMDB_BEARER_TOKEN;
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return undefined;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*(?:export\s+)?TMDB_BEARER_TOKEN\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

// ---- http ------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET a TMDB endpoint. Returns null on 404. Retries 429 (honoring
 * Retry-After) and 5xx / network errors with backoff.
 */
async function tmdbGet<T>(pathname: string, token: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = new URL(`${BASE}${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let lastError: unknown;
  let throttled = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (res.status === 404) return null;
      if (res.status === 429 && throttled++ < MAX_429_WAITS) {
        const wait = Number(res.headers.get("retry-after") ?? 1);
        await sleep((Number.isFinite(wait) ? wait : 1) * 1000 + 250);
        attempt--; // rate limiting is not a failure; wait it out
        continue;
      }
      if (res.status >= 500) throw new Error(`TMDB ${res.status} for ${pathname}`);
      if (!res.ok) throw new Error(`TMDB ${res.status} for ${pathname}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// ---- TMDB shapes we read ---------------------------------------------------

interface RawCast {
  id: number;
  name: string;
  character?: string;
  order?: number;
  total_episode_count?: number;
  roles?: { character?: string }[];
}

interface RawCredits {
  id?: number;
  cast?: RawCast[];
}

interface RawFind {
  movie_results?: { id: number }[];
  tv_results?: { id: number }[];
}

// ---- crawl -----------------------------------------------------------------

const TV_TYPES = new Set(["tvSeries", "tvMiniSeries"]);

/**
 * Crawl credits for the given titles. Cached titles are read from disk and
 * never refetched, so a complete cache means zero network calls.
 */
export async function crawlCredits(opts: CrawlOptions): Promise<Map<string, CachedCredits>> {
  const log = opts.log ?? (() => {});
  const { cacheDir, token, titles } = opts;
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const out = new Map<string, CachedCredits>();

  /** tmdb person id → imdb id (or null). In-flight promises dedupe the fetch. */
  const personImdb = new Map<number, Promise<string | null>>();

  const resolvePerson = (tmdbId: number): Promise<string | null> => {
    let p = personImdb.get(tmdbId);
    if (p) return p;
    p = (async () => {
      const cached = readJson<{ tmdbId: number; imdbId: string | null }>(personCachePath(cacheDir, tmdbId));
      if (cached) return cached.imdbId;
      const data = await tmdbGet<{ imdb_id?: string | null }>(`/person/${tmdbId}/external_ids`, token);
      const imdbId = data?.imdb_id && /^nm\d+$/.test(data.imdb_id) ? data.imdb_id : null;
      writeJson(personCachePath(cacheDir, tmdbId), { tmdbId, imdbId });
      return imdbId;
    })();
    personImdb.set(tmdbId, p);
    return p;
  };

  let done = 0;
  let fetched = 0;
  let missing = 0;

  const one = async (title: CrawlTitle): Promise<void> => {
    const file = titleCachePath(cacheDir, title.imdbId);
    const cached = readJson<CachedCredits | CachedMiss>(file);
    if (cached) {
      if (!("missing" in cached)) out.set(cached.imdbId, cached);
      else missing++;
      return;
    }

    const raw = await fetchCredits(title, token);
    if (!raw) {
      writeJson(file, { imdbId: title.imdbId, missing: true } satisfies CachedMiss);
      missing++;
      return;
    }
    fetched++;

    const known = opts.knownPeople?.get(title.imdbId);
    const cast: CachedCastMember[] = [];
    for (const c of raw.cast) {
      // Resolve for free when the IMDb graph already has this name on this title.
      const byName = known?.get(c.name.toLowerCase()) ?? null;
      const imdbId = byName ?? (await resolvePerson(c.tmdbId));
      cast.push({ ...c, imdbId });
    }
    const credits: CachedCredits = { imdbId: title.imdbId, tmdbId: raw.tmdbId, mediaType: raw.mediaType, cast };
    writeJson(file, credits);
    out.set(title.imdbId, credits);
  };

  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= titles.length) return;
      try {
        await one(titles[i]);
      } catch (err) {
        log(`tmdb: ${titles[i].imdbId} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      done++;
      if (done % 500 === 0) log(`tmdb: ${done}/${titles.length} titles (${fetched} fetched, ${missing} missing)`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  log(`tmdb: ${out.size} titles with credits (${fetched} fetched, ${missing} missing, ${personImdb.size} people resolved)`);
  return out;
}

/** One title's cast from TMDB, capped and normalized. Null when TMDB has no record. */
async function fetchCredits(
  title: CrawlTitle,
  token: string,
): Promise<{ tmdbId: number; mediaType: "movie" | "tv"; cast: Omit<CachedCastMember, "imdbId">[] } | null> {
  if (TV_TYPES.has(title.titleType)) {
    const found = await tmdbGet<RawFind>(`/find/${title.imdbId}`, token, { external_source: "imdb_id" });
    const tmdbId = found?.tv_results?.[0]?.id;
    if (!tmdbId) return null;
    let credits = await tmdbGet<RawCredits>(`/tv/${tmdbId}/aggregate_credits`, token).catch(() => null);
    let aggregate = true;
    if (!credits?.cast?.length) {
      credits = await tmdbGet<RawCredits>(`/tv/${tmdbId}/credits`, token).catch(() => null);
      aggregate = false;
    }
    if (!credits?.cast?.length) return null;
    return { tmdbId, mediaType: "tv", cast: normalizeCast(credits.cast, aggregate) };
  }

  // Movie endpoints accept IMDb ids directly, so this is one call per title.
  let credits = await tmdbGet<RawCredits>(`/movie/${title.imdbId}/credits`, token);
  let tmdbId = credits?.id ?? 0;
  if (!credits) {
    const found = await tmdbGet<RawFind>(`/find/${title.imdbId}`, token, { external_source: "imdb_id" });
    tmdbId = found?.movie_results?.[0]?.id ?? 0;
    if (!tmdbId) return null;
    credits = await tmdbGet<RawCredits>(`/movie/${tmdbId}/credits`, token);
  }
  if (!credits?.cast?.length || !tmdbId) return null;
  return { tmdbId, mediaType: "movie", cast: normalizeCast(credits.cast, false) };
}

/**
 * Cap and normalize a raw cast list. Movie/tv credits order by billing;
 * aggregate_credits orders by episode count (the recurring-cast signal).
 */
function normalizeCast(cast: RawCast[], aggregate: boolean): Omit<CachedCastMember, "imdbId">[] {
  const rows = cast.map((c, i) => ({
    tmdbId: c.id,
    name: c.name ?? "",
    character: (aggregate ? c.roles?.[0]?.character : c.character) ?? "",
    order: aggregate ? -(c.total_episode_count ?? 0) : (c.order ?? i),
  }));
  rows.sort((a, b) => a.order - b.order || a.tmdbId - b.tmdbId);
  return rows.slice(0, CAST_CAP).map((r, i) => ({ ...r, order: aggregate ? i : r.order, name: r.name }));
}
