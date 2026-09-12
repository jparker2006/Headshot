/**
 * The pure rules behind the row of ten (SPEC v5, "Ratings"). Kept out of the
 * component so `tests/client/scoreRules.test.ts` can hold the keyboard map and
 * the words to account without React.
 */
import type { WatchedRating } from "@/lib/taste/types";
import { SCORE_MAX, SCORE_MIN } from "@/lib/taste/score";

/** The ten cells, in order. The tenth is typed as `0` — the board says so. */
export const SCORES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** The keys that pick a score: `1`…`9`, then `0` for ten. */
export const SCORE_KEYS: readonly string[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

/** A keypress → the score it picks, or null when that key does nothing. */
export function scoreFromKey(key: string): number | null {
  const at = SCORE_KEYS.indexOf(key);
  if (at < 0) return null;
  const score = at + 1;
  return score >= SCORE_MIN && score <= SCORE_MAX ? score : null;
}

/** The digit a score is typed with: 10 is `0`. */
export function keyForScore(score: number): string {
  return SCORE_KEYS[score - 1] ?? "";
}

/** The score as the log table draws it: a bare mono figure, or nothing. */
export function scoreWord(score: number | null | undefined): string {
  return score == null ? "" : String(score);
}

/** The score spelled out, for prose and titles: `8/10`. */
export function scoreOutOf(score: number | null | undefined): string {
  return score == null ? "" : `${score}/${SCORE_MAX}`;
}

/**
 * What a log row says in its score column: the figure when it is rated, the
 * state word otherwise. This is the whole rating vocabulary in v5 — no
 * buckets, no colour.
 */
export function ratingWord(row: { state: WatchedRating; score: number | null }): string {
  if (row.state === "rated") return scoreWord(row.score) || "—";
  return row.state === "unseen" ? "not seen" : row.state;
}

/** True when a rating word is a figure rather than a state (drawn in mono). */
export function isFigureWord(row: { state: WatchedRating; score: number | null }): boolean {
  return row.state === "rated" && row.score != null;
}

/**
 * The same word from a stored row, which calls the state `rating` (the column
 * name) rather than `state`. `"8"`, `"want"`, `"seen"`, `"not seen"`.
 */
export function watchedWord(row: { rating: WatchedRating; score?: number | null }): string {
  return ratingWord({ state: row.rating, score: row.score ?? null });
}
