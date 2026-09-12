/**
 * The pure rules behind the Numbers log table, kept out of the component so
 * `tests/client/numbersLog.test.ts` can hold them to account without React.
 */
import type { NumbersLogRow } from "@/lib/taste/numbers";

/**
 * The chips above the log table (SPEC v5 → Log page). One at a time; `all` is
 * the default. The four bucket words are gone: a row is either rated (it
 * carries a score of 1-10) or it carries one of the two states a person can
 * say out loud, `want` and `seen`.
 */
export const LOG_FILTERS = ["all", "rated", "want", "seen", "films", "shows"] as const;
export type LogFilter = (typeof LOG_FILTERS)[number];

/** How many rows the table draws before "show more". */
export const LOG_PAGE = 100;

/**
 * Does this row survive the chip and the text box? The text matches the title
 * and its year, so "1999" finds a year and "gump" finds a film; the chip is
 * either a kind or a state, never both.
 */
export function matchesLog(row: Pick<NumbersLogRow, "name" | "year" | "kind" | "state" | "score">, filter: LogFilter, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q && !`${row.name} ${row.year ?? ""}`.toLowerCase().includes(q)) return false;
  switch (filter) {
    case "all":
      return true;
    case "films":
      return row.kind === "movie";
    case "shows":
      return row.kind === "series";
    case "rated":
      return row.state === "rated" && row.score != null;
    default:
      return row.state === filter;
  }
}

// ---- the one sentence on You ----------------------------------------------

/** What `numbersSentence` needs from the numbers route; nothing else. */
export interface SentenceTotals {
  titles: number;
  films: number;
  shows: number;
  hours: number;
}

export interface DecadeCount {
  decade: string;
  count: number;
}

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * The whole of Numbers on the You page, said out loud in one line (SPEC v5 →
 * You page): "130 titles, 222 hours. 113 films, 17 shows. mostly 2000s and
 * 2010s." Terse, lowercase, no exclamation — the voice in DESIGN.md → Copy.
 *
 * Pure so `tests/client/numbersSentence.test.ts` can hold every shape of an
 * empty, a one-title and a lopsided log to account without a renderer.
 */
export function numbersSentence(totals: SentenceTotals, decades: readonly DecadeCount[] = []): string {
  if (totals.titles <= 0) return "nothing logged yet.";

  const parts: string[] = [];
  parts.push(totals.hours > 0 ? `${count(totals.titles, "title")}, ${count(totals.hours, "hour")}.` : `${count(totals.titles, "title")}.`);

  const kinds: string[] = [];
  if (totals.films > 0) kinds.push(count(totals.films, "film"));
  if (totals.shows > 0) kinds.push(count(totals.shows, "show"));
  if (kinds.length > 0) parts.push(`${kinds.join(", ")}.`);

  // The two decades you actually live in. A decade nobody has more than one
  // title in is not a habit, so a log that thin says nothing about decades.
  const top = [...decades]
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count || (a.decade < b.decade ? -1 : 1))
    .slice(0, 2);
  if (top.length > 0 && top[0].count > 1) {
    const names = top.filter((d) => d.count > 1).map((d) => d.decade);
    parts.push(`mostly ${names.length === 2 ? `${names[0]} and ${names[1]}` : names[0]}.`);
  }

  return parts.join(" ");
}

const TMDB_IMAGE = "https://image.tmdb.org/t/p";

/** The poster thumbnail for a log row, or null when TMDB had none. */
export function posterThumb(posterPath: string | null, size = "w92"): string | null {
  return posterPath ? `${TMDB_IMAGE}/${size}${posterPath}` : null;
}

/** "2 Mar 2026", or an em dash when the user never said when. */
export function logDate(watchedAt: string | null): string {
  if (!watchedAt) return "—";
  const date = new Date(watchedAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
