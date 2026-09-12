/**
 * Letterboxd import. Pure functions only: parsing a real export, matching its
 * rows against the industry graph, and choosing the rows a human should check.
 * No network, no store — the route in `src/app/api/taste/import` wires it up.
 *
 * The real export is a zip of CSVs; we take the three that carry signal:
 *   watched.csv    Date,Name,Year,Letterboxd URI
 *   ratings.csv    Date,Name,Year,Letterboxd URI,Rating
 *   watchlist.csv  Date,Name,Year,Letterboxd URI
 *   diary.csv      Date,Name,Year,Letterboxd URI,Rating,...,Watched Date,...
 */
import type { NodeInfo } from "@/lib/graph/engine";
import type { NodeKind } from "@/lib/graph/format";
import type { WatchedInput, WatchedRating } from "./types";
import { scoreFromStars } from "./score";

/** One parsed row, before it has been matched to anything. */
export interface LetterboxdRow {
  name: string;
  year: number | null;
  /** 0.5–5 in half steps, or null when the title was logged without a rating. */
  rating: number | null;
  /** ISO date, or null. */
  watchedAt: string | null;
  list: "watched" | "watchlist";
}

export interface LetterboxdFiles {
  ratings?: string;
  watched?: string;
  watchlist?: string;
  diary?: string;
}

export interface MatchedRow {
  row: LetterboxdRow;
  imdbId: string;
  /** The graph's name for the match, which may differ from Letterboxd's. */
  name: string;
  year: number;
  /** 1.0 exact name + year · 0.7 exact name · 0.5 substring + year. */
  confidence: number;
}

export interface MatchResult {
  matched: MatchedRow[];
  unmatched: LetterboxdRow[];
}

// ---- CSV ------------------------------------------------------------------

/**
 * A small RFC 4180 reader: quoted fields, doubled quotes inside them, commas
 * and newlines inside quotes, and CRLF or LF line endings. Titles like
 * "Good Night, and Good Luck." are why this exists instead of `split(",")`.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let started = false;

  const endField = () => {
    row.push(field);
    field = "";
    started = false;
  };
  const endRow = () => {
    endField();
    // A trailing newline must not produce a final empty row.
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && !started) {
      quoted = true;
      started = true;
    } else if (c === ",") endField();
    else if (c === "\n") endRow();
    else if (c === "\r") continue;
    else {
      field += c;
      started = true;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  // Strip a UTF-8 BOM that Letterboxd's export sometimes carries.
  if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^﻿/, "");
  return rows;
}

/** CSV text → objects keyed by the header row, with headers trimmed. */
export function parseTable(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

function toYear(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 1800 ? n : null;
}

function toRating(raw: string): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toDate(raw: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  return raw.slice(0, 10);
}

function key(name: string, year: number | null): string {
  return `${name.trim().toLowerCase()}|${year ?? ""}`;
}

/**
 * Parse the export into one row per title. Files are merged in signal order —
 * ratings and diary carry the most, watchlist the least — so a title that
 * appears in several files keeps its rating and its watch date, and a title on
 * both the watched list and the watchlist counts as watched.
 */
export function parseLetterboxd(files: LetterboxdFiles): LetterboxdRow[] {
  const byKey = new Map<string, LetterboxdRow>();

  const add = (row: LetterboxdRow) => {
    if (!row.name) return;
    const k = key(row.name, row.year);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, row);
      return;
    }
    prev.rating = prev.rating ?? row.rating;
    prev.watchedAt = prev.watchedAt ?? row.watchedAt;
    // Watched beats watchlist: you cannot want to see what you have seen.
    if (row.list === "watched") prev.list = "watched";
  };

  for (const r of parseTable(files.ratings ?? "")) {
    add({
      name: r.Name ?? "",
      year: toYear(r.Year ?? ""),
      rating: toRating(r.Rating ?? ""),
      watchedAt: toDate(r.Date ?? ""),
      list: "watched",
    });
  }
  for (const r of parseTable(files.diary ?? "")) {
    add({
      name: r.Name ?? "",
      year: toYear(r.Year ?? ""),
      rating: toRating(r.Rating ?? ""),
      watchedAt: toDate(r["Watched Date"] ?? r.Date ?? ""),
      list: "watched",
    });
  }
  for (const r of parseTable(files.watched ?? "")) {
    add({
      name: r.Name ?? "",
      year: toYear(r.Year ?? ""),
      rating: null,
      watchedAt: toDate(r.Date ?? ""),
      list: "watched",
    });
  }
  for (const r of parseTable(files.watchlist ?? "")) {
    add({
      name: r.Name ?? "",
      year: toYear(r.Year ?? ""),
      rating: null,
      watchedAt: null,
      list: "watchlist",
    });
  }
  return [...byKey.values()];
}

// ---- scores ---------------------------------------------------------------

/**
 * One Letterboxd row as a v5 state plus a score (SPEC v5, "Ratings").
 *
 * Stars double, half stars rounding up, so 3.5★ — the old "liked" line — is a
 * 7 and still liked. A watched row with no rating is the lossy case:
 * Letterboxd knows only that you logged it, so it lands in `seen` (watched, no
 * opinion) rather than having a number put in the user's mouth. A watchlist
 * row is `want`.
 */
export function scoreFor(row: LetterboxdRow): { rating: WatchedRating; score: number | null } {
  if (row.list === "watchlist") return { rating: "want", score: null };
  if (row.rating === null) return { rating: "seen", score: null };
  return { rating: "rated", score: scoreFromStars(row.rating) };
}

/** Matched rows as taste-store input. `replaceImport` stamps the source. */
export function toWatchedInputs(matched: MatchedRow[]): WatchedInput[] {
  return matched.map((m) => ({
    titleImdbId: m.imdbId,
    ...scoreFor(m.row),
    source: "letterboxd" as const,
    watchedAt: m.row.watchedAt ? `${m.row.watchedAt}T00:00:00.000Z` : null,
  }));
}

// ---- matching -------------------------------------------------------------

/** The slice of the graph this module needs, so tests can pass a stub. */
export interface TitleSearch {
  searchByName(query: string, limit?: number, kind?: NodeKind): NodeInfo[];
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Match rows to the industry graph by title plus year. Four tiers, and a row
 * that reaches none of them is unmatched rather than guessed at:
 *   1.0  the same name and the same year
 *   0.7  the same name, a different year (or no year in the export)
 *   0.5  the graph name contains the row's name, and the year matches
 *   —    anything else
 */
export function matchToGraph(graph: TitleSearch, rows: LetterboxdRow[]): MatchResult {
  const matched: MatchedRow[] = [];
  const unmatched: LetterboxdRow[] = [];

  for (const row of rows) {
    const hits = graph.searchByName(row.name, 5, "title");
    const want = norm(row.name);
    let best: { hit: NodeInfo; confidence: number } | null = null;

    for (const hit of hits) {
      const exact = norm(hit.name) === want;
      const sameYear = row.year !== null && hit.year === row.year;
      const confidence = exact && sameYear ? 1 : exact ? 0.7 : sameYear && norm(hit.name).includes(want) ? 0.5 : 0;
      if (confidence === 0) continue;
      // Ties go to the more popular title: the graph sorts substring hits by
      // votes, so the first hit at a given confidence is the right one.
      if (!best || confidence > best.confidence) best = { hit, confidence };
    }

    if (!best) unmatched.push(row);
    else matched.push({ row, imdbId: best.hit.imdbId, name: best.hit.name, year: best.hit.year, confidence: best.confidence });
  }

  return { matched, unmatched };
}

/**
 * The rows a human should look at: least confident first, then oldest-looking
 * first by name so the list is stable between uploads.
 */
export function worstMatches(matched: MatchedRow[], n = 10): MatchedRow[] {
  return [...matched]
    .sort((a, b) => a.confidence - b.confidence || (a.row.name < b.row.name ? -1 : a.row.name > b.row.name ? 1 : 0))
    .slice(0, n);
}
