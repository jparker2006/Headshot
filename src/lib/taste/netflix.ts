/**
 * Netflix viewing-activity import. Pure functions only: parsing the export,
 * collapsing episode rows to the show they belong to, matching against the
 * industry graph, and turning the result into store rows.
 *
 * The export is one CSV, `NetflixViewingHistory.csv`:
 *
 *   Title,Date
 *   Fleabag: Season 1: Episode 1,9/11/26
 *   Breaking Bad: Season 2: "Grilled",11/09/2026
 *   Stranger Things: Stranger Things 2: Chapter One,9/10/26
 *   Apollo 13,9/09/26
 *
 * Netflix knows only that you pressed play, never what you thought of it, so
 * every row lands in the neutral `seen` bucket (SPEC v4). Nothing here is ever
 * `liked`: that would put words in the user's mouth.
 */
import type { NodeInfo } from "@/lib/graph/engine";
import { parseTable, type TitleSearch } from "./letterboxd";
import type { WatchedInput } from "./types";

/** One collapsed title: a film, or a show with everything watched folded in. */
export interface NetflixRow {
  /** The show or film title, with the season and episode stripped off. */
  title: string;
  /** Latest ISO date (YYYY-MM-DD) seen for this title, or null. */
  date: string | null;
  /** True when at least one row for this title was an episode. */
  series: boolean;
  /** How many episode rows collapsed into this one. 0 for a film. */
  episodes: number;
  /** Highest season number seen, or null for a film. */
  season: number | null;
}

export interface NetflixMatch {
  row: NetflixRow;
  imdbId: string;
  /** The graph's name for the match, which may differ from Netflix's. */
  name: string;
  year: number;
  /** 1.0 exact name, right kind · 0.7 exact name, other kind · 0.5 substring. */
  confidence: number;
}

export interface NetflixMatchResult {
  matched: NetflixMatch[];
  unmatched: NetflixRow[];
}

// ---- dates ----------------------------------------------------------------

/**
 * Netflix writes the date in the account's locale and never says which one:
 * `9/11/26` is September 11th for a US account and November 9th for a UK one.
 * A file is one account, so one heuristic settles the whole file — if any row
 * has a first component above 12 the export must be day-first, and otherwise
 * month-first is the safer read (Netflix's default, and the ambiguous case).
 */
export function dateOrder(raw: string[]): "mdy" | "dmy" {
  for (const value of raw) {
    const parts = value.trim().split(/[/-]/);
    if (parts.length !== 3) continue;
    const first = Number.parseInt(parts[0], 10);
    const second = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(first) || !Number.isFinite(second)) continue;
    if (first > 12 && second <= 12) return "dmy";
  }
  return "mdy";
}

/** `9/11/26` or `11/09/2026` → `2026-09-11`, given the file's order. */
export function toIsoDate(raw: string, order: "mdy" | "dmy"): string | null {
  const parts = raw.trim().split(/[/-]/);
  if (parts.length !== 3) return null;
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  // A four-digit leading number is an ISO date, whatever the rest of the file does.
  const [month, day, year] = parts[0].length === 4 ? [nums[1], nums[2], nums[0]] : order === "mdy" ? [nums[0], nums[1], nums[2]] : [nums[1], nums[0], nums[2]];
  const full = year >= 100 ? year : year < 70 ? 2000 + year : 1900 + year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(full).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ---- title collapsing ------------------------------------------------------

const SEASON_WORD = /^(?:season|series|volume|book|part|chapter)\s+(\d+)\b/i;
const LIMITED = /^limited series\b/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The season a segment names, or null when it names no season at all.
 *
 * Three shapes, all of them real:
 *   `Season 1`            Fleabag: Season 1: Episode 1
 *   `Limited Series`      The Queen's Gambit: Limited Series: Openings
 *   `<show title> 2`      Stranger Things: Stranger Things 2: Chapter One
 */
function seasonOf(segment: string, showSoFar: string): number | null {
  const word = SEASON_WORD.exec(segment);
  if (word) return Number.parseInt(word[1], 10);
  if (LIMITED.test(segment)) return 1;
  const named = new RegExp(`^${escapeRegExp(showSoFar)}\\s+(\\d+)$`, "i").exec(segment.trim());
  return named ? Number.parseInt(named[1], 10) : null;
}

export interface CollapsedTitle {
  title: string;
  /** The season this row belongs to, or null when the row is a film. */
  season: number | null;
}

/**
 * `Breaking Bad: Season 2: "Grilled"` → `{ title: "Breaking Bad", season: 2 }`.
 * A film has no season marker and comes back whole, colons and all, so
 * `Léon: The Professional` is not mistaken for a show.
 */
export function collapseTitle(raw: string): CollapsedTitle {
  const parts = raw.split(": ");
  for (let i = 1; i < parts.length; i++) {
    const showSoFar = parts.slice(0, i).join(": ");
    const season = seasonOf(parts[i], showSoFar);
    if (season !== null) return { title: showSoFar.trim(), season };
  }
  return { title: raw.trim(), season: null };
}

/**
 * Parse the export into one row per title, newest date kept. Episodes of the
 * same show fold into a single row carrying the count and the highest season,
 * because SPEC v4 counts episodes and never logs them individually.
 */
export function parseNetflix(text: string): NetflixRow[] {
  const table = parseTable(text);
  const order = dateOrder(table.map((r) => r.Date ?? ""));
  const byTitle = new Map<string, NetflixRow>();

  for (const raw of table) {
    const title = (raw.Title ?? "").trim();
    if (!title) continue;
    const { title: name, season } = collapseTitle(title);
    if (!name) continue;
    const date = toIsoDate(raw.Date ?? "", order);

    const key = name.toLowerCase();
    const prev = byTitle.get(key);
    if (!prev) {
      byTitle.set(key, {
        title: name,
        date,
        series: season !== null,
        episodes: season === null ? 0 : 1,
        season,
      });
      continue;
    }
    if (date && (!prev.date || date > prev.date)) prev.date = date;
    if (season !== null) {
      prev.series = true;
      prev.episodes += 1;
      prev.season = Math.max(prev.season ?? 0, season);
    }
  }

  return [...byTitle.values()];
}

// ---- matching --------------------------------------------------------------

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function isSeries(node: NodeInfo): boolean {
  return node.titleType === "tvSeries" || node.titleType === "tvMiniSeries";
}

/**
 * Match collapsed rows to the graph. Netflix gives no year, so the name is all
 * there is: an exact name wins, a substring is the fallback, and ties go to
 * the more popular title. A row that collapsed from episodes prefers a series
 * node — "Fargo" is both a film and a show, and only one of them has seasons.
 */
export function matchNetflix(graph: TitleSearch, rows: NetflixRow[]): NetflixMatchResult {
  const matched: NetflixMatch[] = [];
  const unmatched: NetflixRow[] = [];

  for (const row of rows) {
    const want = norm(row.title);
    let best: { hit: NodeInfo; confidence: number } | null = null;

    for (const hit of graph.searchByName(row.title, 8, "title")) {
      const exact = norm(hit.name) === want;
      const kindFits = !row.series || isSeries(hit);
      const confidence = exact && kindFits ? 1 : exact ? 0.7 : kindFits && norm(hit.name).includes(want) ? 0.5 : 0;
      if (confidence === 0) continue;
      if (!best || confidence > best.confidence || (confidence === best.confidence && hit.votes > best.hit.votes)) {
        best = { hit, confidence };
      }
    }

    if (!best) unmatched.push(row);
    else matched.push({ row, imdbId: best.hit.imdbId, name: best.hit.name, year: best.hit.year, confidence: best.confidence });
  }

  return { matched, unmatched };
}

/** Matched rows as taste-store input: `seen`, never liked. */
export function toNetflixInputs(matched: NetflixMatch[]): WatchedInput[] {
  return matched.map((m) => ({
    titleImdbId: m.imdbId,
    rating: "seen" as const,
    source: "netflix" as const,
    watchedAt: m.row.date ? `${m.row.date}T00:00:00.000Z` : null,
    season: m.row.season,
    episodesWatched: m.row.episodes,
  }));
}

/** The rows a human should check: least confident first, then by name. */
export function worstNetflixMatches(matched: NetflixMatch[], n = 10): NetflixMatch[] {
  return [...matched]
    .sort((a, b) => a.confidence - b.confidence || (a.row.title < b.row.title ? -1 : a.row.title > b.row.title ? 1 : 0))
    .slice(0, n);
}
