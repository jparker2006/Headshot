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

/**
 * A score as it is written anywhere it is shown (SPEC v5.1: scores are
 * one-decimal). `9.7` keeps its decimal, `8` stays a bare `8` — a trailing
 * `.0` is noise, and a stored integer must not start reading as a precision
 * nobody typed. Anything finer than a tenth is rounded to one.
 */
export function formatScore(score: number): string {
  const tenths = Math.round(score * 10) / 10;
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
}

/** The score as the log table draws it: a bare mono figure, or nothing. */
export function scoreWord(score: number | null | undefined): string {
  return score == null ? "" : formatScore(score);
}

/** The score spelled out, for prose and titles: `8/10`, `9.7/10`. */
export function scoreOutOf(score: number | null | undefined): string {
  return score == null ? "" : `${formatScore(score)}/${SCORE_MAX}`;
}

/**
 * The cell of the row of ten a value lights: the ten stay whole numbers, so a
 * 9.7 highlights the 10 and the exact figure is printed beside the row.
 */
export function nearestCell(score: number | null | undefined): number | null {
  if (score == null) return null;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(score)));
}

/** True when a value is finer than the row of ten can show on its own. */
export function hasDecimal(score: number | null | undefined): boolean {
  return score != null && !Number.isInteger(Math.round(score * 10) / 10);
}

/**
 * What someone typed into a score field -> the score to store, or null when it
 * is not one. Tenths, 1-10; `9.75` rounds to `9.8`, `11` and `0` are not scores.
 */
export function parseScore(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,2}(\.\d+)?$/.test(t)) return null;
  const n = Math.round(Number(t) * 10) / 10;
  return n >= SCORE_MIN && n <= SCORE_MAX ? n : null;
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
