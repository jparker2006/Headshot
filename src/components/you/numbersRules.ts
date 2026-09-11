/**
 * The pure rules behind the Numbers log table, kept out of the component so
 * `tests/client/numbersLog.test.ts` can hold them to account without React.
 */
import type { NumbersLogRow } from "@/lib/taste/numbers";

/** The chips above the table. One at a time; `all` is the default. */
export const LOG_FILTERS = ["all", "films", "shows", "liked", "meh", "seen", "want"] as const;
export type LogFilter = (typeof LOG_FILTERS)[number];

/** How many rows the table draws before "show more". */
export const LOG_PAGE = 100;

/**
 * Does this row survive the chip and the text box? The text matches the title
 * and its year, so "1999" finds a year and "gump" finds a film; the chip is a
 * kind or a bucket, never both.
 */
export function matchesLog(row: NumbersLogRow, filter: LogFilter, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q && !`${row.name} ${row.year ?? ""}`.toLowerCase().includes(q)) return false;
  switch (filter) {
    case "all":
      return true;
    case "films":
      return row.kind === "movie";
    case "shows":
      return row.kind === "series";
    default:
      return row.rating === filter;
  }
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
