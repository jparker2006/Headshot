import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STEPS,
  SESSION_MIN,
  SESSION_SIZE,
  canFinish,
  deckBlurb,
  deckCardMeta,
  deckKindWord,
  diffCount,
  diffLineText,
  diffLines,
  finishLabel,
  isNewAccount,
  nextStep,
  progressLabel,
  stepLabel,
  type OnboardingStep,
} from "@/components/you/swipeRules";

describe("session end rules", () => {
  it("lets you stop by hand only after ten cards", () => {
    expect(SESSION_MIN).toBe(10);
    for (let rated = 0; rated < SESSION_MIN; rated++) expect(canFinish(rated)).toBe(false);
    expect(canFinish(SESSION_MIN)).toBe(true);
    expect(canFinish(SESSION_SIZE)).toBe(true);
  });

  it("says what stopping early would cost, then invites you to stop", () => {
    expect(finishLabel(0)).toBe("10 more and I'll rewrite your profile");
    expect(finishLabel(7)).toBe("3 more and I'll rewrite your profile");
    expect(finishLabel(9)).toBe("1 more and I'll rewrite your profile");
    expect(finishLabel(10)).toBe("done for now");
    expect(finishLabel(29)).toBe("done for now");
  });

  it("counts the card you are looking at, and never past the deck", () => {
    expect(progressLabel(0, 30)).toBe("1 / 30");
    expect(progressLabel(11, 30)).toBe("12 / 30");
    expect(progressLabel(30, 30)).toBe("30 / 30");
    expect(progressLabel(0, 0)).toBe("0 / 0");
  });
});

describe("deck mode", () => {
  it("says where the thirty came from, differently when it has nothing on you", () => {
    expect(deckBlurb("lore")).toBe("unrated things the people you like keep turning up in");
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

describe("deck-first onboarding", () => {
  it("runs the deck first, then services, then imports", () => {
    expect(ONBOARDING_STEPS).toEqual(["swipe", "services", "imports"]);
    expect(nextStep("swipe")).toBe("services");
    expect(nextStep("services")).toBe("imports");
    expect(nextStep("imports")).toBeNull();
    expect(nextStep("nope" as OnboardingStep)).toBeNull();
  });

  it("indexes the steps as a mono figure out of three", () => {
    expect(stepLabel("swipe")).toBe("1 / 3");
    expect(stepLabel("services")).toBe("2 / 3");
    expect(stepLabel("imports")).toBe("3 / 3");
  });

  it("calls an account new only when the log is read and empty", () => {
    expect(isNewAccount([])).toBe(true);
    expect(isNewAccount([{ titleImdbId: "tt0110912" }])).toBe(false);
    // Not read yet, or the route failed: never new. A hundred titles must not
    // flash the onboarding deck at their owner.
    expect(isNewAccount(null)).toBe(false);
    expect(isNewAccount(undefined)).toBe(false);
  });
});
