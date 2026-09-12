import { describe, expect, it } from "vitest";
import {
  SCORES,
  SCORE_KEYS,
  isFigureWord,
  keyForScore,
  ratingWord,
  scoreFromKey,
  scoreOutOf,
  scoreWord,
  watchedWord,
} from "@/components/log/scoreRules";

describe("the row of ten", () => {
  it("offers exactly ten scores", () => {
    expect(SCORES).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(SCORE_KEYS).toHaveLength(10);
  });

  it("types 1-9 as themselves and ten as 0", () => {
    expect(SCORE_KEYS.join("")).toBe("1234567890");
    expect(scoreFromKey("1")).toBe(1);
    expect(scoreFromKey("9")).toBe(9);
    expect(scoreFromKey("0")).toBe(10);
    expect(keyForScore(10)).toBe("0");
    expect(keyForScore(8)).toBe("8");
  });

  it("ignores every other key", () => {
    for (const key of ["a", "Enter", "Escape", " ", "-", "10"]) expect(scoreFromKey(key)).toBeNull();
  });
});

describe("the words a score is said in", () => {
  it("draws a score as a bare figure and spells it out where prose needs it", () => {
    expect(scoreWord(8)).toBe("8");
    expect(scoreWord(10)).toBe("10");
    expect(scoreWord(null)).toBe("");
    expect(scoreOutOf(8)).toBe("8/10");
    expect(scoreOutOf(null)).toBe("");
  });

  it("says the state when there is no score", () => {
    expect(ratingWord({ state: "rated", score: 8 })).toBe("8");
    expect(ratingWord({ state: "want", score: null })).toBe("want");
    expect(ratingWord({ state: "seen", score: null })).toBe("seen");
    expect(ratingWord({ state: "unseen", score: null })).toBe("not seen");
    // a rated row with no score cannot happen, but it must not read as blank
    expect(ratingWord({ state: "rated", score: null })).toBe("—");
  });

  it("reads a stored row the same way", () => {
    expect(watchedWord({ rating: "rated", score: 5 })).toBe("5");
    expect(watchedWord({ rating: "want" })).toBe("want");
  });

  it("knows which words are figures, so only those are set in mono", () => {
    expect(isFigureWord({ state: "rated", score: 8 })).toBe(true);
    expect(isFigureWord({ state: "seen", score: null })).toBe(false);
  });
});
