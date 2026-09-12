import { describe, expect, it } from "vitest";
import {
  SESSION_SIZE,
  UNDO_KEY,
  UNSEEN_ACTION,
  VERDICTS,
  deckBlurb,
  deckCardMeta,
  deckKindWord,
  diffCount,
  diffLineText,
  diffLines,
  doneLabel,
  progressLabel,
  scoreAction,
} from "@/components/you/swipeRules";

describe("a round of ten", () => {
  it("deals ten, not thirty", () => {
    expect(SESSION_SIZE).toBe(10);
  });

  it("lets you stop at any point: there is no floor to reach", () => {
    // The label never changes, because the offer never changes — the rewrite
    // runs on whatever was committed, including nothing.
    expect(doneLabel()).toBe("done for now");
    expect(doneLabel()).not.toContain("more");
  });

  it("counts the card you are looking at, and never past the ten", () => {
    expect(progressLabel(0, 10)).toBe("1 / 10");
    expect(progressLabel(2, 10)).toBe("3 / 10");
    expect(progressLabel(10, 10)).toBe("10 / 10");
    expect(progressLabel(0, 0)).toBe("0 / 0");
  });
});

describe("the two-step card", () => {
  it("asks seen it / not seen first, on s and n", () => {
    expect(VERDICTS.map((v) => v.label)).toEqual(["seen it", "not seen"]);
    expect(VERDICTS.map((v) => v.key)).toEqual(["s", "n"]);
    // Copy rules: lowercase, no punctuation, no shouting.
    for (const v of VERDICTS) {
      expect(v.label).toBe(v.label.toLowerCase());
      expect(v.label).not.toContain("!");
    }
    // The keys are distinct from each other and from undo.
    expect(new Set([...VERDICTS.map((v) => v.key), UNDO_KEY]).size).toBe(3);
  });

  it("writes a state for not seen and a score for a number", () => {
    expect(UNSEEN_ACTION).toEqual({ rating: "unseen" });
    expect(UNSEEN_ACTION).not.toHaveProperty("score");
    expect(scoreAction(8)).toEqual({ rating: "rated", score: 8 });
    expect(scoreAction(1)).toEqual({ rating: "rated", score: 1 });
    expect(scoreAction(10)).toEqual({ rating: "rated", score: 10 });
  });
});

describe("deck mode", () => {
  it("says where the ten came from, differently when it has nothing on you", () => {
    expect(deckBlurb("lore")).toBe("things I think you have probably seen, going by who you like");
    expect(deckBlurb("cold")).toBe("the well-known ones, because I have nothing on you yet");
    expect(deckBlurb("lore")).not.toBe(deckBlurb("cold"));
    // Copy rules: one line, sentence-fragment lowercase at the front, no
    // exclamation mark ("I" stays a capital — it is the machine talking).
    for (const mode of ["lore", "cold"] as const) {
      expect(deckBlurb(mode)[0]).toBe(deckBlurb(mode)[0].toLowerCase());
      expect(deckBlurb(mode)).not.toContain("!");
      expect(deckBlurb(mode)).not.toContain("\n");
    }
  });
});

describe("the card's one mono line", () => {
  it("speaks film and show, never movie and series", () => {
    expect(deckKindWord({ kind: "film" })).toBe("film");
    expect(deckKindWord({ kind: "show" })).toBe("show");
    // The pre-v4 spelling still resolves, so an old deck payload still reads right.
    expect(deckKindWord({ kind: null, titleType: "movie" })).toBe("film");
    expect(deckKindWord({ kind: null, titleType: "tvSeries" })).toBe("show");
    expect(deckKindWord({})).toBe("show");
  });

  it("drops a fact rather than faking it", () => {
    expect(deckCardMeta({ imdbId: "tt1", name: "Blade Runner", year: 1982, kind: "film", runtime: 117 })).toBe("1982 · film · 117m");
    expect(deckCardMeta({ imdbId: "tt2", name: "The Wire", year: 2002, kind: "show" })).toBe("2002 · show");
    expect(deckCardMeta({ imdbId: "tt3", name: "Untitled", kind: "film" })).toBe("film");
  });
});

describe("the memory diff", () => {
  it("counts the moved lines as one mono figure", () => {
    expect(diffCount({ added: ["a", "b", "c"], removed: ["d"] })).toBe("+3 −1");
    expect(diffCount({ added: ["a"], removed: [] })).toBe("+1");
    expect(diffCount({ added: [], removed: ["d", "e"] })).toBe("−2");
    expect(diffCount({ added: [], removed: [] })).toBe("no change");
  });

  it("uses a real minus sign, not a hyphen", () => {
    expect(diffCount({ added: [], removed: ["d"] })).toBe("−" + "1");
    expect(diffCount({ added: [], removed: ["d"] })).not.toContain("-");
  });

  it("strips the markdown, because a diff is a change log and not prose", () => {
    expect(diffLineText("## What you love")).toBe("What you love");
    expect(diffLineText("- you keep coming back to **Michael Mann**")).toBe("you keep coming back to Michael Mann");
    expect(diffLineText("*  a bullet  ")).toBe("a bullet");
    expect(diffLines(["", "## Notes", "   ", "- one"])).toEqual(["Notes", "one"]);
  });
});
