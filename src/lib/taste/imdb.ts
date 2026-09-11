/**
 * IMDb ratings import. Pure functions only.
 *
 * The export is one CSV, `ratings.csv`, and unlike every other import it
 * carries the IMDb id itself:
 *
 *   Const,Your Rating,Date Rated,Title,URL,Title Type,IMDb Rating,
 *   Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
 *   tt0000001,9,2026-02-01,Apollo 13,https://…,Movie,7.7,140,1995,…
 *
 * So there is no matching to do and nothing to review: the id either exists in
 * the industry graph or it does not, and the ones that do not are reported as
 * skipped rather than guessed at by name.
 */
import { parseTable } from "./letterboxd";
import type { WatchedInput, WatchedRating } from "./types";

/** One rated title, straight from the export. */
export interface ImdbRow {
  imdbId: string;
  name: string;
  year: number | null;
  /** The user's own 1–10 rating. */
  rating: number;
  /** ISO date (YYYY-MM-DD) the rating was given, or null. */
  ratedAt: string | null;
  /** IMDb's own label: "Movie", "TV Series", … Informational only. */
  titleType: string | null;
}

export interface ImdbMatch {
  row: ImdbRow;
  imdbId: string;
  /** The graph's name, which may differ from the export's. */
  name: string;
  year: number;
}

export interface ImdbMatchResult {
  matched: ImdbMatch[];
  /** Ids the graph has never heard of. Skipped, not an error. */
  skipped: ImdbRow[];
}

/** The slice of the graph this module needs: id resolution, nothing else. */
export interface TitleById {
  nodeByImdbId(imdbId: string): { imdbId: string; name: string; year: number } | undefined;
}

function toIso(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  // Older exports wrote the US short date instead of an ISO one.
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!us) return null;
  return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
}

/**
 * Parse the export, keyed by `Const`. A row without an id or without a rating
 * is not a rating row and is dropped; the last row for an id wins, which is
 * what a re-export of a changed rating means.
 */
export function parseImdb(text: string): ImdbRow[] {
  const byId = new Map<string, ImdbRow>();
  for (const raw of parseTable(text)) {
    const imdbId = (raw.Const ?? "").trim();
    if (!/^tt\d+$/.test(imdbId)) continue;
    const rating = Number.parseInt(raw["Your Rating"] ?? "", 10);
    if (!Number.isFinite(rating) || rating < 1 || rating > 10) continue;
    const year = Number.parseInt(raw.Year ?? "", 10);
    byId.set(imdbId, {
      imdbId,
      name: (raw.Title ?? "").trim(),
      year: Number.isFinite(year) && year > 1800 ? year : null,
      rating,
      ratedAt: toIso(raw["Date Rated"] ?? ""),
      titleType: (raw["Title Type"] ?? "").trim() || null,
    });
  }
  return [...byId.values()];
}

/** SPEC v4: 7 and up is liked, below it is meh. No third bucket. */
export function bucketForImdb(rating: number): WatchedRating {
  return rating >= 7 ? "liked" : "meh";
}

/** Resolve every id against the graph; the misses come back as `skipped`. */
export function matchImdb(graph: TitleById, rows: ImdbRow[]): ImdbMatchResult {
  const matched: ImdbMatch[] = [];
  const skipped: ImdbRow[] = [];
  for (const row of rows) {
    const node = graph.nodeByImdbId(row.imdbId);
    if (!node) skipped.push(row);
    else matched.push({ row, imdbId: node.imdbId, name: node.name, year: node.year });
  }
  return { matched, skipped };
}

/** Matched rows as taste-store input. */
export function toImdbInputs(matched: ImdbMatch[]): WatchedInput[] {
  return matched.map((m) => ({
    titleImdbId: m.imdbId,
    rating: bucketForImdb(m.row.rating),
    source: "imdb" as const,
    watchedAt: m.row.ratedAt ? `${m.row.ratedAt}T00:00:00.000Z` : null,
  }));
}
