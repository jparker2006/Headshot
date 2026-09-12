/**
 * The list rows on You, as pure rules (SPEC v5 → You page; v5.3 → "right
 * now"). The page draws them; it never decides what is in them, so
 * `tests/client/youRows.test.ts` can hold the cuts to account without a
 * renderer.
 */
import type { WatchedRow } from "@/lib/taste/types";

/** How many series "right now" carries. */
export const RIGHT_NOW_ROWS = 6;

/**
 * Right now: the series you are part-way through — a row with a season marked
 * that you have actually started (`want` is Later and `unseen` is a removal),
 * most recently touched first, six at most. It comes from the log, never from
 * the model (SPEC v5.3, story 89).
 */
export function rightNowRows<T extends Pick<WatchedRow, "titleImdbId" | "rating" | "season" | "updatedAt">>(
  rows: readonly T[],
  limit = RIGHT_NOW_ROWS,
): T[] {
  return rows
    .filter((r) => r.season != null && r.rating !== "want" && r.rating !== "unseen")
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, limit);
}

/**
 * Later: the `want` rows, newest addition first. A row with no timestamp sorts
 * last rather than to the top — the same rule `recentlyLogged` follows.
 */
export function laterRows<T extends Pick<WatchedRow, "titleImdbId" | "rating" | "updatedAt">>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.rating === "want").sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}
