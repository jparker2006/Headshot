/**
 * The Letterboxd crawl (SPEC v5, story 75): you type your username and your
 * history appears — no export, no zip, no CSV.
 *
 * Three public pages, read the way a browser reads them:
 *   /<user>/films/page/<n>/         the poster grid, with a rating class
 *   /<user>/watchlist/page/<n>/     the same grid, everything wanted
 *   /<user>/films/diary/page/<n>/   one row per viewing, with the date
 *
 * Rules that are not negotiable, because this is someone else's server:
 * requests are sequential and {@link CRAWL_DELAY_MS} apart, they carry a real
 * browser User-Agent, and the walk stops the moment a page adds nothing (an
 * empty grid, or only slugs already seen), with a hard cap of
 * {@link MAX_PAGES}.
 *
 * Parsing is deliberately tolerant: Letterboxd's markup has moved from
 * `data-film-slug` to `data-item-slug` and back, so every field is looked for
 * in each of its known spellings and the `/film/<slug>/` link is the floor.
 * Matching is *not* re-invented — the rows come out as {@link LetterboxdRow},
 * the same shape the CSV import produces, and go through the same
 * `matchToGraph` / `toWatchedInputs` pair, so both paths score identically.
 *
 * Everything that touches the world is injected (`fetch`, `sleep`, `now`), so
 * `tests/taste/letterboxdCrawl.test.ts` runs the whole thing over fixture HTML
 * with a fake clock and no network.
 */
import { matchToGraph, toWatchedInputs, type LetterboxdRow, type TitleSearch } from "./letterboxd";
import type { CrawlRow, WatchedInput } from "./types";

/** Milliseconds between two requests to letterboxd.com. */
export const CRAWL_DELAY_MS = 300;

/** Hard stop, so a pathological profile cannot walk forever. */
export const MAX_PAGES = 200;

/** A real browser string: Letterboxd serves a bot a different, emptier page. */
export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const LETTERBOXD_ORIGIN = "https://letterboxd.com";

/** Letterboxd usernames: letters, digits and underscore, 2–15 characters. */
export const USERNAME_RE = /^[A-Za-z0-9_]{2,15}$/;

export function isValidUsername(username: unknown): username is string {
  return typeof username === "string" && USERNAME_RE.test(username);
}

/** The slice of `fetch` the crawl uses. Response bodies are read as text. */
export type CrawlFetch = (url: string, init: { headers: Record<string, string> }) => Promise<{ status: number; text(): Promise<string> }>;

export interface CrawlDeps {
  fetch: CrawlFetch;
  /** Defaults to a real timer; tests pass a fake that records the waits. */
  sleep?: (ms: number) => Promise<void>;
  /** Defaults to the real clock. */
  now?: () => Date;
  delayMs?: number;
  maxPages?: number;
  log?: (message: string) => void;
}

/** One title as the grid carries it, before anything has been matched. */
export interface CrawlItem {
  slug: string;
  name: string;
  year: number | null;
  /** 1–10 half-stars (Letterboxd's `rated-N`), or null when unrated. */
  halfStars: number | null;
  /** ISO date, diary only. */
  watchedAt: string | null;
}

/** What a films/watchlist page turned out to be. */
export interface ParsedPage {
  items: CrawlItem[];
  /** The page says the profile is private, whatever else it carries. */
  private: boolean;
}

export type CrawlOutcome =
  | { private: true }
  | { notFound: true }
  | { rows: LetterboxdRow[]; pages: number };

/** The synchronous answer the route needs before it promises anything. */
export type ProbeOutcome = { private: true } | { notFound: true } | { ok: true };

// ---- parsing --------------------------------------------------------------

const PRIVATE_RE = /(?:profile|account|this member[^.<]{0,40})\s+is\s+private|private\s+(?:profile|account)|only\s+visible\s+to\s+(?:their|his|her)\s+friends/i;

/** A four-digit year at the end of a slug ("blade-runner-2049" is not one). */
function yearFromSlug(slug: string): { name: string; year: number | null } {
  const m = /^(.*)-(\d{4})$/.exec(slug);
  const year = m ? Number(m[2]) : NaN;
  // Letterboxd only suffixes a year to disambiguate a remake, and it is always
  // a plausible release year; anything else is part of the title.
  if (m && year >= 1880 && year <= 2100) return { name: m[1], year };
  return { name: slug, year: null };
}

/** "the-godfather-part-ii" → "the godfather part ii". The matcher lowercases anyway. */
export function titleFromSlug(slug: string): { name: string; year: number | null } {
  const { name, year } = yearFromSlug(slug);
  return { name: name.replace(/-/g, " ").trim(), year };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&eacute;/g, "é");
}

function attr(chunk: string, names: string[]): string | null {
  for (const name of names) {
    const m = new RegExp(`${name}="([^"]*)"`).exec(chunk);
    if (m && m[1]) return decodeEntities(m[1]);
  }
  return null;
}

/** The slug, from whichever attribute this vintage of the markup carries. */
function slugOf(chunk: string): string | null {
  const direct = attr(chunk, ["data-film-slug", "data-item-slug", "data-item-link"]);
  if (direct) {
    const fromLink = /\/film\/([^/"?#]+)/.exec(direct);
    return fromLink ? fromLink[1] : direct.replace(/^\/+|\/+$/g, "");
  }
  const link = /\/film\/([^/"?#]+)\//.exec(chunk);
  return link ? link[1] : null;
}

/** The title the page prints, or null when only the slug is there. */
function nameOf(chunk: string): string | null {
  return attr(chunk, ["data-film-name", "data-item-name", "data-item-full-display-name", "alt"]);
}

/** `rated-8` → 8. Letterboxd counts half-stars, so the range is 1–10. */
function halfStarsOf(chunk: string): number | null {
  const m = /\brated-(\d{1,2})\b/.exec(chunk);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 10 ? n : null;
}

/** A year printed next to the title ("(1995)" or a `/films/year/1995/` link). */
function yearOf(chunk: string): number | null {
  const attrYear = attr(chunk, ["data-film-release-year", "data-item-release-year", "data-film-year"]);
  if (attrYear && /^\d{4}$/.test(attrYear)) return Number(attrYear);
  const link = /\/films\/year\/(\d{4})\//.exec(chunk);
  if (link) return Number(link[1]);
  return null;
}

/** Split a page into its list items, whichever element the grid is built from. */
function chunksOf(html: string, tag: "li" | "tr"): string[] {
  const out: string[] = [];
  const open = new RegExp(`<${tag}\\b`, "gi");
  let m: RegExpExecArray | null;
  const positions: number[] = [];
  while ((m = open.exec(html))) positions.push(m.index);
  for (let i = 0; i < positions.length; i++) {
    out.push(html.slice(positions[i], positions[i + 1] ?? html.length));
  }
  return out;
}

/**
 * A films or watchlist page. Every item the grid carries, in page order; an
 * item with no slug at all is not an item (the grid's `<li>` scaffolding).
 */
export function parseGridPage(html: string): ParsedPage {
  const items: CrawlItem[] = [];
  const seen = new Set<string>();
  for (const chunk of chunksOf(html, "li")) {
    const slug = slugOf(chunk);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const fromSlug = titleFromSlug(slug);
    items.push({
      slug,
      name: nameOf(chunk) ?? fromSlug.name,
      year: yearOf(chunk) ?? fromSlug.year,
      halfStars: halfStarsOf(chunk),
      watchedAt: null,
    });
  }
  return { items, private: PRIVATE_RE.test(html) };
}

/**
 * A diary page. One row per viewing: the slug, the rating of that viewing and
 * the date it happened, which is the only place Letterboxd prints a real date.
 */
export function parseDiaryPage(html: string): ParsedPage {
  const items: CrawlItem[] = [];
  for (const chunk of chunksOf(html, "tr")) {
    const slug = slugOf(chunk);
    if (!slug) continue;
    const fromSlug = titleFromSlug(slug);
    const date = /\/(?:films\/)?diary\/for\/(\d{4})\/(\d{2})\/(\d{2})\//.exec(chunk);
    items.push({
      slug,
      name: nameOf(chunk) ?? fromSlug.name,
      year: yearOf(chunk) ?? fromSlug.year,
      halfStars: halfStarsOf(chunk),
      watchedAt: date ? `${date[1]}-${date[2]}-${date[3]}` : null,
    });
  }
  return { items, private: PRIVATE_RE.test(html) };
}

// ---- rows -----------------------------------------------------------------

/**
 * A crawled item as the CSV import's row. The score model is shared on
 * purpose: `halfStars` is exactly Letterboxd's `rated-N`, and halving it back
 * into stars means `scoreFor` (stars × 2, half stars up) returns N again, so a
 * crawled 4★ and an exported 4★ are both an 8.
 */
export function toLetterboxdRow(item: CrawlItem, list: "watched" | "watchlist"): LetterboxdRow {
  return {
    name: item.name,
    year: item.year,
    rating: item.halfStars === null ? null : item.halfStars / 2,
    watchedAt: item.watchedAt,
    list,
  };
}

/** The crawl's rows, matched to the graph and ready for `replaceImport`. */
export function crawlToInputs(graph: TitleSearch, rows: LetterboxdRow[]): { inputs: WatchedInput[]; unmatched: number } {
  const { matched, unmatched } = matchToGraph(graph, rows);
  return { inputs: toWatchedInputs(matched), unmatched: unmatched.length };
}

// ---- the walk -------------------------------------------------------------

function pageUrl(username: string, section: "films" | "watchlist" | "diary", page: number): string {
  const path = section === "diary" ? "films/diary" : section;
  return `${LETTERBOXD_ORIGIN}/${username}/${path}/page/${page}/`;
}

class PrivateProfile extends Error {}
class MissingProfile extends Error {}

/**
 * One section, page by page. Stops on an empty grid, on a page that adds no
 * new slug (Letterboxd answers the last page again past the end), and at the
 * page cap. 403 is a private profile and 404 an unknown user, both of which
 * are answers rather than failures.
 */
async function walk(
  username: string,
  section: "films" | "watchlist" | "diary",
  deps: CrawlDeps,
  state: { requests: number },
  parse: (html: string) => ParsedPage,
): Promise<CrawlItem[]> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const delay = deps.delayMs ?? CRAWL_DELAY_MS;
  const maxPages = Math.min(deps.maxPages ?? MAX_PAGES, MAX_PAGES);

  const out: CrawlItem[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    // Sequential and polite: every request after the very first one waits.
    if (state.requests > 0) await sleep(delay);
    state.requests++;
    const url = pageUrl(username, section, page);
    const res = await deps.fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html" } });
    if (res.status === 404) throw new MissingProfile(url);
    if (res.status === 403) throw new PrivateProfile(url);
    if (res.status >= 400) throw new Error(`letterboxd ${res.status} on ${url}`);

    const parsed = parse(await res.text());
    // A private profile serves a page with no grid and a notice; page 1 is
    // where we believe it, since a later empty page is simply the end.
    if (parsed.items.length === 0) {
      if (page === 1 && parsed.private) throw new PrivateProfile(url);
      break;
    }
    const fresh = parsed.items.filter((i) => !seen.has(i.slug));
    if (fresh.length === 0) break;
    for (const item of fresh) {
      seen.add(item.slug);
      out.push(item);
    }
    deps.log?.(`[letterboxd] ${section} page ${page}: ${fresh.length} items`);
  }
  return out;
}

/**
 * Fetch page one and say what kind of profile this is. The route calls this
 * before it promises anything, so "private" and "no such user" are answered in
 * the request rather than discovered by a poll five seconds later.
 */
export async function probeLetterboxd(username: string, deps: CrawlDeps): Promise<ProbeOutcome> {
  const url = pageUrl(username, "films", 1);
  const res = await deps.fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html" } });
  if (res.status === 404) return { notFound: true };
  if (res.status === 403) return { private: true };
  if (res.status >= 400) throw new Error(`letterboxd ${res.status} on ${url}`);
  const parsed = parseGridPage(await res.text());
  if (parsed.items.length === 0 && parsed.private) return { private: true };
  return { ok: true };
}

/**
 * The whole crawl: films (the ratings), watchlist (the wants), diary (the
 * dates). Later sections only add what the earlier ones lacked — a diary entry
 * contributes its date and its per-viewing rating to a film already in the
 * grid, and a film on both the watchlist and the films page stays watched.
 */
export async function crawlLetterboxd(username: string, deps: CrawlDeps): Promise<CrawlOutcome> {
  const state = { requests: 0 };
  try {
    const films = await walk(username, "films", deps, state, parseGridPage);
    const watchlist = await walk(username, "watchlist", deps, state, parseGridPage);
    const diary = await walk(username, "diary", deps, state, parseDiaryPage);

    const bySlug = new Map<string, LetterboxdRow>();
    for (const item of films) bySlug.set(item.slug, toLetterboxdRow(item, "watched"));
    for (const item of watchlist) {
      // You cannot want what you have seen: a slug in both lists is watched.
      if (!bySlug.has(item.slug)) bySlug.set(item.slug, toLetterboxdRow(item, "watchlist"));
    }
    for (const item of diary) {
      const row = bySlug.get(item.slug);
      if (!row) {
        bySlug.set(item.slug, toLetterboxdRow(item, "watched"));
        continue;
      }
      row.list = "watched";
      row.rating = row.rating ?? (item.halfStars === null ? null : item.halfStars / 2);
      // The diary is the only page with dates; the newest one we saw wins.
      row.watchedAt = row.watchedAt ?? item.watchedAt;
    }
    return { rows: [...bySlug.values()], pages: state.requests };
  } catch (err) {
    if (err instanceof PrivateProfile) return { private: true };
    if (err instanceof MissingProfile) return { notFound: true };
    throw err;
  }
}

// ---- the 24h cache --------------------------------------------------------

export const CRAWL_CACHE_MS = 24 * 60 * 60 * 1000;

/**
 * True when this user already crawled this username inside the cache window
 * and it worked. A failed, private or not-found run is never cached: the user
 * fixed something and is asking again.
 */
export function isFreshCrawl(row: CrawlRow | null, username: string, now: Date, windowMs = CRAWL_CACHE_MS): boolean {
  if (!row || row.status !== "done" || row.username.toLowerCase() !== username.toLowerCase()) return false;
  const finished = row.finishedAt ? Date.parse(row.finishedAt) : NaN;
  return Number.isFinite(finished) && now.getTime() - finished < windowMs;
}
