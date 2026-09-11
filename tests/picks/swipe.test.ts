import { describe, it, expect } from "vitest";
import { committedRows, initialSwipeState, swipeReducer } from "@/lib/picks/swipe";

describe("swipe deck reducer", () => {
  it("swipes the top card, undoes, redoes, and round-trips the committed rows", () => {
    let s = initialSwipeState(["a", "b", "c"]);
    s = swipeReducer(s, { type: "swipe", action: "liked", at: 1 });
    s = swipeReducer(s, { type: "swipe", action: "meh", at: 2 });
    expect(s.remaining).toEqual(["c"]);
    expect(committedRows(s)).toEqual([
      { imdbId: "a", rating: "liked" },
      { imdbId: "b", rating: "meh" },
    ]);
    s = swipeReducer(s, { type: "undo" });
    expect(s.remaining).toEqual(["b", "c"]);
    expect(committedRows(s)).toEqual([{ imdbId: "a", rating: "liked" }]);
    s = swipeReducer(s, { type: "redo" });
    expect(s.remaining).toEqual(["c"]);
    expect(committedRows(s)).toHaveLength(2);
    // A new swipe clears the redo stack.
    s = swipeReducer(s, { type: "undo" });
    s = swipeReducer(s, { type: "swipe", action: "want", at: 3 });
    expect(s.undone).toEqual([]);
    expect(committedRows(s)).toEqual([
      { imdbId: "a", rating: "liked" },
      { imdbId: "b", rating: "want" },
    ]);
  });

  it("skip moves the card to the back without recording anything; empty decks are inert", () => {
    let s = initialSwipeState(["a", "b"]);
    s = swipeReducer(s, { type: "skip" });
    expect(s.remaining).toEqual(["b", "a"]);
    expect(s.swipes).toEqual([]);
    const empty = initialSwipeState([]);
    expect(swipeReducer(empty, { type: "swipe", action: "liked" })).toBe(empty);
    expect(swipeReducer(empty, { type: "undo" })).toBe(empty);
    expect(swipeReducer(empty, { type: "redo" })).toBe(empty);
  });
});
