/**
 * The 1–10 score model (SPEC v5, "Ratings").
 *
 * v3/v4 rated in four words (liked / meh / want / unseen, plus v4's `seen`).
 * v5 splits that into a *state* — `rated | want | seen | unseen` — and, when
 * the state is `rated`, a `score` from 1 to 10 in tenths, the way IMDb does it.
 * "Liked" stops being a bucket and becomes a threshold: `score >= 7`. v5.1
 * widened the score itself from an integer to one decimal (9.7 is a score).
 *
 * Everything in here is pure and has no opinion about where a row came from,
 * so the engine, the imports, Numbers, the memory rewrite and the deck can all
 * ask the same two questions ("did they like it", "have they watched it")
 * without each inventing its own arithmetic.
 */
import type { WatchedRating } from "./types";

/** The threshold that means "they liked it". SPEC v5: seven and up. */
export const LIKED_MIN = 7;

/** The lowest and highest score a rated row may carry (one decimal in between). */
export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

/** The shape every helper needs: the state, and the score when there is one. */
export interface ScoredRow {
  rating: WatchedRating;
  score?: number | null;
}

/** Rated seven or better. The v5 replacement for the `liked` bucket. */
export function isLiked(row: ScoredRow): boolean {
  return row.rating === "rated" && (row.score ?? 0) >= LIKED_MIN;
}

/** Rated below seven (6.9 and down). The v5 replacement for the `meh` bucket. */
export function isMeh(row: ScoredRow): boolean {
  return row.rating === "rated" && row.score != null && row.score < LIKED_MIN;
}

/**
 * "You already watched this": a scored row or a neutral `seen`. `want` is a
 * plan and `unseen` is a no, so neither counts.
 */
export function isWatched(row: ScoredRow): boolean {
  return row.rating === "rated" || row.rating === "seen";
}

/**
 * A score 1.0–10.0 in tenths, or nothing (SPEC v5.1: "scores are one-decimal").
 * 9.7 is a score; 9.75 is not, and neither is 0 or 11. Float arithmetic means
 * `9.7 * 10` is `96.99999999999999`, so the tenths test rounds first and then
 * compares the rounded value back against the input at one decimal.
 */
export function isValidScore(score: unknown): score is number {
  if (typeof score !== "number" || !Number.isFinite(score)) return false;
  if (score < SCORE_MIN || score > SCORE_MAX) return false;
  return roundScore(score) === score;
}

/** One decimal, the way every score is stored and compared. */
export function roundScore(score: number): number {
  return Math.round(score * 10) / 10;
}

/**
 * Clamp to 1–10 and round to a whole number. The imports (stars, IMDb) are
 * whole by definition, so this stays integer; a decimal a person typed goes
 * through `roundScore` instead.
 */
export function clampScore(score: number): number {
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(score)));
}

/**
 * The store's guard on a row a caller supplies: a `rated` row carries a
 * score 1–10 in tenths and every other state carries nothing. Returns the score to
 * write; throws when the pair does not hold, so a bad write never reaches
 * Postgres and the memory store behaves identically.
 */
export function validateScore(row: { titleImdbId?: string; rating: WatchedRating; score?: number | null }): number | null {
  const where = row.titleImdbId ? ` (${row.titleImdbId})` : "";
  if (row.rating === "rated") {
    if (!isValidScore(row.score)) throw new Error(`watched: a rated row needs a score 1-10 in tenths, got ${String(row.score)}${where}`);
    return row.score;
  }
  if (row.score != null) throw new Error(`watched: only a rated row may carry a score, got ${String(row.score)} on "${row.rating}"${where}`);
  return null;
}

/**
 * Letterboxd stars (0.5–5, half steps) → 1–10. Doubling is the obvious map;
 * a half star lands between two integers and rounds up, so 3.5 stars (the old
 * "liked" threshold) becomes 7, which is still liked.
 */
export function scoreFromStars(stars: number): number {
  return clampScore(Math.ceil(stars * 2));
}

/** IMDb exports are already 1–10; keep the number the user chose. */
export function scoreFromImdb(n: number): number {
  return clampScore(n);
}

/** What a phrase in chat is worth, or null when it is not an opinion at all. */
const STATEMENTS: { score: number; patterns: RegExp[] }[] = [
  { score: 9, patterns: [/\bloved\b/, /\blove\b/, /\bfavou?rite\b/, /\bbest\b/] },
  { score: 2, patterns: [/\bhated\b/, /\bhate\b/, /\bawful\b/, /\bterrible\b/, /\bworst\b/] },
  { score: 4, patterns: [/n['o]?t like\b/, /\bnot for me\b/, /\bboring\b/, /\bdisliked\b/] },
  // "like" only as a verb they own ("i like it"): a bare "like" is usually a
  // comparison ("something like Heat"), which says nothing about a score.
  { score: 8, patterns: [/\bliked\b/, /\b(?:i|we)(?:\s+\w+)? like\b/, /\bgood\b/, /\bgreat\b/] },
  { score: 6, patterns: [/\bfine\b/, /\bokay\b/, /\bok\b/, /\balright\b/, /\ball right\b/] },
];

/**
 * A sentence the user said about a title → a score. Negatives are tested
 * before positives so "didn't like it" is a 4 and not an 8, and "not for me"
 * beats the "for me" nobody wrote.
 */
export function scoreFromStatement(text: string): number | null {
  const t = text.toLowerCase();
  for (const { score, patterns } of STATEMENTS) if (patterns.some((p) => p.test(t))) return score;
  return null;
}
