/**
 * The Letterboxd crawl (SPEC v5, story 75): you type your username and your
 * history appears — no export, no zip, no CSV.
 *
 * Four public documents, read the way a browser reads them:
 *   /<user>/films/         the poster grid, with a rating class (72 per page)
 *   /<user>/watchlist/     the same grid, everything wanted (28 per page)
 *   /<user>/diary/         one row per viewing, with the date (50 per page)
 *   /<user>/rss/           the last 100 viewings, with dates and ratings
 *
 * What Letterboxd actually serves a server today (verified against a real
 * public profile): page one of every section is fine, but *every* paginated or
 * sorted films/diary URL answers 403 to a non-browser client — `/films/page/2/`,
 * `/films/by/date/`, `/films/diary/` — while the watchlist pages fine. So the
 * crawl reads page one of films and the diary, walks the whole watchlist, and
 * leans on the RSS feed for the recent viewings; a 403 past page one is the
 * expected end of a section, not a failure, and the result says so
 * ({@link CrawlOutcome.partial}). The CSV export stays the complete path.
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
 * Today's grid is a `<li class="griditem">` holding a `react-component` whose
 * `data-item-name` is "Title (Year)", so the year comes back out of the name.
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
  /** The count in the section heading ("2,577 films"), when it prints one. */
  total: number | null;
}

export type CrawlOutcome =
  | { private: true }
  | { notFound: true }
  /** Letterboxd refused page one: not private, just not talking to us. */
  | { blocked: true }
  | {
      rows: LetterboxdRow[];
      pages: number;
      /** A section stopped on a 403 before it ran out: this is not everything. */
      partial: boolean;
      /** What the films heading says the profile holds, when it says. */
      total: number | null;
    };

/** The synchronous answer the route needs before it promises anything. */
export type ProbeOutcome = { private: true } | { notFound: true } | { blocked: true } | { ok: true };

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

/**
 * "Blue Heron (2025)" → the title and the year. Today's grid prints the year
 * inside `data-item-name`, and it is the only year on the page.
 */
export function splitDisplayName(raw: string): { name: string; year: number | null } {
  const m = /^(.*?)\s*\((\d{4})\)\s*$/.exec(raw);
  if (m) {
    const year = Number(m[2]);
    if (year >= 1880 && year <= 2100) return { name: m[1].trim(), year };
  }
  return { name: raw.trim(), year: null };
}

/** The title the page prints, or null when only the slug is there. */
function nameOf(chunk: string): { name: string; year: number | null } | null {
  const raw = attr(chunk, ["data-film-name", "data-item-name", "data-item-full-display-name", "alt"]);
  return raw ? splitDisplayName(raw) : null;
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

/**
 * The number the section heading carries: `<h1 class="section-heading"><span
 * class="tooltip" title="2,577&nbsp;films">Watched</span></h1>`. It is the only
 * place a profile says how much there is, which is how the import can admit it
 * read 96 of 2,577.
 */
export function totalOf(html: string): number | null {
  const heading = /<h1[^>]*class="[^"]*section-heading[^"]*"[^>]*>([\s\S]{0,400}?)<\/h1>/i.exec(html);
  const scope = heading ? heading[1] : "";
  const m = /title="([\d,]+)(?:&nbsp;|\s)*films?"/i.exec(scope);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
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
    const printed = nameOf(chunk);
    items.push({
      slug,
      name: printed?.name ?? fromSlug.name,
      year: yearOf(chunk) ?? printed?.year ?? fromSlug.year,
      halfStars: halfStarsOf(chunk),
      watchedAt: null,
    });
  }
  return { items, private: PRIVATE_RE.test(html), total: totalOf(html) };
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
    const printed = nameOf(chunk);
    // The day link is `/dave/diary/films/for/2026/09/08/` today and was
    // `/dave/films/diary/for/...` once; both spellings are read.
    const date = /\/diary\/(?:films\/)?for\/(\d{4})\/(\d{2})\/(\d{2})\//.exec(chunk);
    items.push({
      slug,
      name: printed?.name ?? fromSlug.name,
      year: yearOf(chunk) ?? printed?.year ?? fromSlug.year,
      halfStars: halfStarsOf(chunk),
      watchedAt: date ? `${date[1]}-${date[2]}-${date[3]}` : null,
    });
  }
  return { items, private: PRIVATE_RE.test(html), total: totalOf(html) };
}

/**
 * The RSS feed: up to 100 recent viewings, and the one paginated-free way to
 * reach further back than the 50 rows the diary page will show a server.
 *
 * An `<item>` that carries no `/film/<slug>/` link or none of Letterboxd's own
 * elements is not a viewing (a list, a story), and is skipped. The rating is
 * `memberRating` in stars — 4.5 — and comes back as the same half-star integer
 * the grid's `rated-9` class means, so both paths score identically.
 */
export function parseRss(xml: string): CrawlItem[] {
  const items: CrawlItem[] = [];
  for (const chunk of xml.split(/<item>/i).slice(1)) {
    const body = chunk.split(/<\/item>/i)[0];
    const link = /<link>[^<]*\/film\/([^/<"?#]+)\//.exec(body);
    const title = /<letterboxd:filmTitle>([\s\S]*?)<\/letterboxd:filmTitle>/.exec(body);
    if (!link || !title) continue;
    const slug = link[1];
    const year = /<letterboxd:filmYear>(\d{4})<\/letterboxd:filmYear>/.exec(body);
    const rating = /<letterboxd:memberRating>([\d.]+)<\/letterboxd:memberRating>/.exec(body);
    const watched = /<letterboxd:watchedDate>(\d{4}-\d{2}-\d{2})<\/letterboxd:watchedDate>/.exec(body);
    const stars = rating ? Number(rating[1]) : NaN;
    items.push({
      slug,
      name: decodeEntities(title[1]).trim() || titleFromSlug(slug).name,
      year: year ? Number(year[1]) : titleFromSlug(slug).year,
      halfStars: Number.isFinite(stars) && stars > 0 ? Math.round(stars * 2) : null,
      watchedAt: watched ? watched[1] : null,
    });
  }
  return items;
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

export type Section = "films" | "watchlist" | "diary";

/**
 * Page one has no `/page/1/` spelling — `/dave/films/page/1/` is one of the
 * URLs Letterboxd refuses — so the bare section URL is always the first
 * request, and the diary lives at `/<user>/diary/`, not `/<user>/films/diary/`.
 */
export function pageUrl(username: string, section: Section, page: number): string {
  const base = `${LETTERBOXD_ORIGIN}/${username}/${section}/`;
  return page <= 1 ? base : `${base}page/${page}/`;
}

class PrivateProfile extends Error {}
class MissingProfile extends Error {}
class BlockedProfile extends Error {}

/** One section's haul, and whether Letterboxd cut it short. */
interface SectionResult {
  items: CrawlItem[];
  /** A 403/404 ended the walk while the section still had more to give. */
  partial: boolean;
  total: number | null;
}

/**
 * One section, page by page. Stops on an empty grid, on a page that adds no
 * new slug (Letterboxd answers the last page again past the end), and at the
 * page cap.
 *
 * On page one a 404 is an unknown user and a 403 is Letterboxd refusing to
 * talk to a server at all (never a private profile: private profiles answer
 * 200 with a notice). Past page one a 403 is simply how films and the diary
 * end for a non-browser client, so the section keeps what it already has.
 */
async function walk(
  username: string,
  section: Section,
  deps: CrawlDeps,
  state: { requests: number },
  parse: (html: string) => ParsedPage,
): Promise<SectionResult> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const delay = deps.delayMs ?? CRAWL_DELAY_MS;
  const maxPages = Math.min(deps.maxPages ?? MAX_PAGES, MAX_PAGES);

  const out: CrawlItem[] = [];
  const seen = new Set<string>();
  let partial = false;
  let total: number | null = null;

  for (let page = 1; page <= maxPages; page++) {
    // Sequential and polite: every request after the very first one waits.
    if (state.requests > 0) await sleep(delay);
    state.requests++;
    const url = pageUrl(username, section, page);
    const res = await deps.fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html" } });
    if (res.status === 403 || res.status === 404) {
      if (page === 1) {
        if (res.status === 404) throw new MissingProfile(url);
        throw new BlockedProfile(url);
      }
      deps.log?.(`[letterboxd] ${section} stopped at page ${page}: ${res.status}`);
      partial = true;
      break;
    }
    if (res.status >= 400) throw new Error(`letterboxd ${res.status} on ${url}`);

    const parsed = parse(await res.text());
    if (page === 1) total = parsed.total;
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
  return { items: out, partial, total };
}

/**
 * The RSS pass: one request, same pacing, and never fatal. The feed is the
 * cheapest way past the diary's first page, so a profile that blocks
 * `/diary/page/2/` still gives up its last hundred viewings.
 */
async function walkRss(username: string, deps: CrawlDeps, state: { requests: number }): Promise<CrawlItem[]> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const delay = deps.delayMs ?? CRAWL_DELAY_MS;
  const url = `${LETTERBOXD_ORIGIN}/${username}/rss/`;
  if (state.requests > 0) await sleep(delay);
  state.requests++;
  try {
    const res = await deps.fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html" } });
    if (res.status !== 200) {
      deps.log?.(`[letterboxd] rss ${res.status}`);
      return [];
    }
    const items = parseRss(await res.text());
    deps.log?.(`[letterboxd] rss: ${items.length} viewings`);
    return items;
  } catch (err) {
    deps.log?.(`[letterboxd] rss failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
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
  // 403 on page one is Cloudflare, not a locked profile: the user did nothing
  // wrong and the CSV is the way through, so it is `blocked`, not `private`.
  if (res.status === 403) return { blocked: true };
  if (res.status >= 400) throw new Error(`letterboxd ${res.status} on ${url}`);
  const parsed = parseGridPage(await res.text());
  if (parsed.items.length === 0 && parsed.private) return { private: true };
  return { ok: true };
}

/**
 * The whole crawl: films (the ratings), watchlist (the wants), diary and then
 * RSS (the dates). Later passes only add what the earlier ones lacked — a
 * viewing contributes its date and its per-viewing rating to a film already in
 * the grid, and a film on both the watchlist and the films page stays watched.
 */
export async function crawlLetterboxd(username: string, deps: CrawlDeps): Promise<CrawlOutcome> {
  const state = { requests: 0 };
  try {
    const films = await walk(username, "films", deps, state, parseGridPage);
    const watchlist = await walk(username, "watchlist", deps, state, parseGridPage);
    const diary = await walk(username, "diary", deps, state, parseDiaryPage);
    const rss = await walkRss(username, deps, state);

    const bySlug = new Map<string, LetterboxdRow>();
    for (const item of films.items) bySlug.set(item.slug, toLetterboxdRow(item, "watched"));
    for (const item of watchlist.items) {
      // You cannot want what you have seen: a slug in both lists is watched.
      if (!bySlug.has(item.slug)) bySlug.set(item.slug, toLetterboxdRow(item, "watchlist"));
    }
    // A viewing, wherever it came from: the diary page first, then the feed,
    // which reaches further back than the one diary page a server may read.
    for (const item of [...diary.items, ...rss]) {
      const row = bySlug.get(item.slug);
      if (!row) {
        bySlug.set(item.slug, toLetterboxdRow(item, "watched"));
        continue;
      }
      row.list = "watched";
      row.rating = row.rating ?? (item.halfStars === null ? null : item.halfStars / 2);
      // Viewings are the only source of dates; the newest one we saw wins.
      row.watchedAt = row.watchedAt ?? item.watchedAt;
    }
    return {
      rows: [...bySlug.values()],
      pages: state.requests,
      partial: films.partial || watchlist.partial || diary.partial,
      total: films.total,
    };
  } catch (err) {
    if (err instanceof PrivateProfile) return { private: true };
    if (err instanceof MissingProfile) return { notFound: true };
    if (err instanceof BlockedProfile) return { blocked: true };
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
