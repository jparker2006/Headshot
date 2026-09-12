import { describe, expect, it } from "vitest";
import {
  LIKED_MIN,
  clampScore,
  isLiked,
  isMeh,
  isValidScore,
  isWatched,
  scoreFromImdb,
  scoreFromStars,
  scoreFromStatement,
  validateScore,
} from "@/lib/taste/score";
// TODO(v5-B): the bucket words live only in the route translators now.
import { bucketFromScore, fromLegacyBucket, isLegacyBucket, legacyBucket, scoreFromBucket } from "@/lib/taste/legacy";
import type { WatchedRating } from "@/lib/taste/types";

const row = (rating: WatchedRating, score: number | null = null) => ({ rating, score });

describe("the liked threshold", () => {
  it("is seven", () => {
    expect(LIKED_MIN).toBe(7);
  });

  it("isLiked is a rated seven or better, and nothing else", () => {
    for (const n of [7, 8, 9, 10]) expect(isLiked(row("rated", n))).toBe(true);
    for (const n of [1, 2, 3, 4, 5, 6]) expect(isLiked(row("rated", n))).toBe(false);
    // A state without a score is never liked, whatever the state says.
    expect(isLiked(row("rated", null))).toBe(false);
    expect(isLiked(row("want"))).toBe(false);
    expect(isLiked(row("seen"))).toBe(false);
    expect(isLiked(row("unseen"))).toBe(false);
  });

  it("isMeh is a rated six or worse", () => {
    for (const n of [1, 5, 6]) expect(isMeh(row("rated", n))).toBe(true);
    for (const n of [7, 10]) expect(isMeh(row("rated", n))).toBe(false);
    expect(isMeh(row("rated", null))).toBe(false);
    expect(isMeh(row("seen"))).toBe(false);
    expect(isMeh(row("unseen"))).toBe(false);
  });

  it("liked and meh together are exactly the rated rows", () => {
    for (let n = 1; n <= 10; n++) expect(isLiked(row("rated", n)) !== isMeh(row("rated", n))).toBe(true);
  });

  it("isWatched counts rated and the neutral seen, not plans or refusals", () => {
    expect(isWatched(row("rated", 3))).toBe(true);
    expect(isWatched(row("seen"))).toBe(true);
    expect(isWatched(row("want"))).toBe(false);
    expect(isWatched(row("unseen"))).toBe(false);
  });
});

describe("score validity", () => {
  it("accepts integers 1–10 and nothing else", () => {
    for (let n = 1; n <= 10; n++) expect(isValidScore(n)).toBe(true);
    for (const bad of [0, 11, -3, 7.5, NaN, Infinity, null, undefined, "8"]) expect(isValidScore(bad)).toBe(false);
  });

  it("clamps and rounds into range", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(-4)).toBe(1);
    expect(clampScore(11)).toBe(10);
    expect(clampScore(7.4)).toBe(7);
    expect(clampScore(7.5)).toBe(8);
  });

  it("validateScore returns the score of a rated row and rejects every mismatch", () => {
    expect(validateScore({ rating: "rated", score: 9 })).toBe(9);
    expect(validateScore({ rating: "want" })).toBeNull();
    expect(validateScore({ rating: "seen", score: null })).toBeNull();

    expect(() => validateScore({ rating: "rated" })).toThrow(/score/);
    expect(() => validateScore({ rating: "rated", score: null })).toThrow(/score/);
    expect(() => validateScore({ rating: "rated", score: 0 })).toThrow(/score/);
    expect(() => validateScore({ rating: "rated", score: 11 })).toThrow(/score/);
    expect(() => validateScore({ rating: "rated", score: 4.5 })).toThrow(/score/);
    expect(() => validateScore({ rating: "want", score: 8 })).toThrow(/score/);
    expect(() => validateScore({ rating: "unseen", score: 1 })).toThrow(/score/);
    // The message says which title, when the caller passed one.
    expect(() => validateScore({ titleImdbId: "tt0113277", rating: "rated" })).toThrow(/tt0113277/);
  });
});

describe("the buckets, while the clients still speak them", () => {
  it("isLegacyBucket knows the five old words and nothing else", () => {
    for (const b of ["liked", "meh", "want", "seen", "unseen"]) expect(isLegacyBucket(b)).toBe(true);
    for (const b of ["rated", "", 8, null, undefined]) expect(isLegacyBucket(b)).toBe(false);
  });

  it("scoreFromBucket is the migration's mapping", () => {
    expect(scoreFromBucket("liked")).toBe(8);
    expect(scoreFromBucket("meh")).toBe(5);
  });

  it("bucketFromScore splits at the threshold", () => {
    expect(bucketFromScore(10)).toBe("liked");
    expect(bucketFromScore(7)).toBe("liked");
    expect(bucketFromScore(6)).toBe("meh");
    expect(bucketFromScore(1)).toBe("meh");
  });

  it("a round trip through the migration's scores keeps the bucket", () => {
    for (const b of ["liked", "meh"] as const) expect(bucketFromScore(scoreFromBucket(b))).toBe(b);
  });

  it("legacyBucket says the old word for any row", () => {
    expect(legacyBucket(row("rated", 8))).toBe("liked");
    expect(legacyBucket(row("rated", 2))).toBe("meh");
    expect(legacyBucket(row("want"))).toBe("want");
    expect(legacyBucket(row("seen"))).toBe("seen");
    expect(legacyBucket(row("unseen"))).toBe("unseen");
  });

  it("fromLegacyBucket is its inverse on the states a bucket can name", () => {
    expect(fromLegacyBucket("liked")).toEqual({ rating: "rated", score: 8 });
    expect(fromLegacyBucket("meh")).toEqual({ rating: "rated", score: 5 });
    expect(fromLegacyBucket("want")).toEqual({ rating: "want", score: null });
    expect(fromLegacyBucket("seen")).toEqual({ rating: "seen", score: null });
    expect(fromLegacyBucket("unseen")).toEqual({ rating: "unseen", score: null });
    for (const b of ["liked", "meh", "want", "seen", "unseen"] as const) expect(legacyBucket(fromLegacyBucket(b))).toBe(b);
  });
});

describe("scores from the outside world", () => {
  it("Letterboxd stars double, and a half star rounds up", () => {
    expect(scoreFromStars(5)).toBe(10);
    expect(scoreFromStars(4.5)).toBe(9);
    expect(scoreFromStars(4)).toBe(8);
    expect(scoreFromStars(3.5)).toBe(7);
    expect(scoreFromStars(3)).toBe(6);
    expect(scoreFromStars(1)).toBe(2);
    expect(scoreFromStars(0.5)).toBe(1);
    // Half a star is the floor Letterboxd allows; anything lower still lands in range.
    expect(scoreFromStars(0)).toBe(1);
    expect(scoreFromStars(6)).toBe(10);
  });

  it("the old 3.5-star liked threshold is still liked as a score", () => {
    expect(isLiked(row("rated", scoreFromStars(3.5)))).toBe(true);
    expect(isLiked(row("rated", scoreFromStars(3)))).toBe(false);
  });

  it("IMDb numbers pass straight through, clamped", () => {
    for (let n = 1; n <= 10; n++) expect(scoreFromImdb(n)).toBe(n);
    expect(scoreFromImdb(0)).toBe(1);
    expect(scoreFromImdb(12)).toBe(10);
    expect(scoreFromImdb(7.6)).toBe(8);
  });

  it("the old IMDb bucket line is where the score threshold is", () => {
    expect(isLiked(row("rated", scoreFromImdb(7)))).toBe(true);
    expect(isMeh(row("rated", scoreFromImdb(6)))).toBe(true);
  });
});

describe("scoreFromStatement", () => {
  it("maps what people actually say", () => {
    expect(scoreFromStatement("I loved it")).toBe(9);
    expect(scoreFromStatement("one of my favourite films")).toBe(9);
    expect(scoreFromStatement("that is the best thing I saw all year")).toBe(9);

    expect(scoreFromStatement("I liked it")).toBe(8);
    expect(scoreFromStatement("it was good")).toBe(8);
    expect(scoreFromStatement("great fun")).toBe(8);

    expect(scoreFromStatement("it was fine")).toBe(6);
    expect(scoreFromStatement("okay I guess")).toBe(6);
    expect(scoreFromStatement("alright")).toBe(6);

    expect(scoreFromStatement("I didn't like it")).toBe(4);
    expect(scoreFromStatement("not for me")).toBe(4);
    expect(scoreFromStatement("so boring")).toBe(4);

    expect(scoreFromStatement("I hated it")).toBe(2);
    expect(scoreFromStatement("awful")).toBe(2);
    expect(scoreFromStatement("the worst")).toBe(2);
  });

  it("is case-insensitive and reads a negative before the positive inside it", () => {
    expect(scoreFromStatement("LOVED IT")).toBe(9);
    expect(scoreFromStatement("I did not like it")).toBe(4);
    expect(scoreFromStatement("I don't like musicals")).toBe(4);
  });

  it("is null when nothing was said about it", () => {
    expect(scoreFromStatement("")).toBeNull();
    expect(scoreFromStatement("I watched it on Tuesday")).toBeNull();
    expect(scoreFromStatement("add it to my list")).toBeNull();
  });

  it("every score it can produce is a valid score", () => {
    for (const t of ["loved it", "liked it", "fine", "not for me", "hated it"]) {
      const s = scoreFromStatement(t)!;
      expect(isValidScore(s)).toBe(true);
    }
  });
});
