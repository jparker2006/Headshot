/**
 * The one place that still speaks the pre-v5 rating words.
 *
 * v5 replaced the four buckets with a state plus a 1–10 score (see
 * `./score.ts`), and every server module now speaks that. The clients do not
 * yet: the bucket-word UI (the log field, the drawer, the swipe deck) is
 * rewritten in Chunk B. Until then the routes accept either shape and
 * translate an old word here, at the boundary, so nothing behind them has to
 * know the old vocabulary existed.
 *
 * TODO(v5-B): delete this file with the bucket-word components.
 */
import type { WatchedRating } from "./types";
import { LIKED_MIN } from "./score";

/** The old four-plus-one vocabulary. */
export type LegacyBucket = "liked" | "meh" | "want" | "seen" | "unseen";

const BUCKETS: LegacyBucket[] = ["liked", "meh", "want", "seen", "unseen"];

export function isLegacyBucket(value: unknown): value is LegacyBucket {
  return typeof value === "string" && (BUCKETS as string[]).includes(value);
}

/** The migration's mapping, in code: the old two opinion buckets as scores. */
export function scoreFromBucket(old: "liked" | "meh"): number {
  return old === "liked" ? 8 : 5;
}

/** The inverse: a score in the word a client still renders. */
export function bucketFromScore(score: number): "liked" | "meh" {
  return score >= LIKED_MIN ? "liked" : "meh";
}

/** A bucket word an old client still sends, as the state/score pair v5 stores. */
export function fromLegacyBucket(bucket: LegacyBucket): { rating: WatchedRating; score: number | null } {
  return bucket === "liked" || bucket === "meh"
    ? { rating: "rated", score: scoreFromBucket(bucket) }
    : { rating: bucket, score: null };
}

/** A v5 row in the old words, for a client that still renders them. */
export function legacyBucket(row: { rating: WatchedRating; score?: number | null }): LegacyBucket {
  if (row.rating !== "rated") return row.rating;
  return bucketFromScore(row.score ?? 0);
}
