/**
 * The three rows on You, as pure rules (SPEC v5 → You page). The page draws
 * them; it never decides what is in them, so `tests/client/youRows.test.ts`
 * can hold the cuts to account without a renderer.
 */
import type { WatchedRow } from "@/lib/taste/types";
import type { DecadeCount } from "./numbersRules";

/** How many faces the people row carries — one row of twelve. */
export const PEOPLE_ROW = 12;
/** How many decades the ledger carries. */
export const DECADE_ROWS = 6;

/**
 * The people row: the route already ranks them, so this only takes the first
 * twelve and drops anyone it could not count.
 */
export function peopleRow<T extends { count: number }>(people: readonly T[], limit = PEOPLE_ROW): T[] {
  return people.filter((p) => p.count > 0).slice(0, limit);
}

/** The decades ledger: biggest first, ties by decade, top six. */
export function decadeRows(decades: readonly DecadeCount[], limit = DECADE_ROWS): DecadeCount[] {
  return [...decades]
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count || (a.decade < b.decade ? -1 : 1))
    .slice(0, limit);
}

/**
 * Later: the `want` rows, newest addition first. A row with no timestamp sorts
 * last rather than to the top — the same rule `recentlyLogged` follows.
 */
export function laterRows<T extends Pick<WatchedRow, "titleImdbId" | "rating" | "updatedAt">>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.rating === "want").sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}
