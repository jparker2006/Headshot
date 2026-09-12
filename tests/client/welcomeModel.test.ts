import { describe, it, expect } from "vitest";
import {
  WELCOME_DONE,
  WELCOME_STEPS,
  nextHref,
  shouldWelcome,
  skipHref,
  stepLabel,
  stepNumber,
} from "@/components/welcome/welcomeModel";

describe("welcome steps", () => {
  it("is services, then letterboxd, then catch-up, and nothing else", () => {
    expect(WELCOME_STEPS).toEqual(["services", "letterboxd", "catch-up"]);
  });

  it("walks forward and ends on the log", () => {
    expect(nextHref("services")).toBe("/welcome/letterboxd");
    expect(nextHref("letterboxd")).toBe("/welcome/catch-up");
    expect(nextHref("catch-up")).toBe(WELCOME_DONE);
  });

  it("skips to exactly where it would have gone", () => {
    for (const step of WELCOME_STEPS) expect(skipHref(step)).toBe(nextHref(step));
  });

  it("numbers the steps for the one meta line", () => {
    expect(WELCOME_STEPS.map(stepNumber)).toEqual([1, 2, 3]);
    expect(stepLabel("letterboxd")).toBe("step 2 of 3");
  });
});

describe("shouldWelcome", () => {
  const fresh = { userId: "u1", welcomed: null, watchedCount: 0, hasServices: false };

  it("sends a brand-new account through once", () => {
    expect(shouldWelcome(fresh)).toBe(true);
  });

  it("never sends the same account twice", () => {
    expect(shouldWelcome({ ...fresh, welcomed: "u1" })).toBe(false);
  });

  it("still sends someone else on the same browser", () => {
    expect(shouldWelcome({ ...fresh, welcomed: "someone-else" })).toBe(true);
  });

  it("leaves an account that has logged anything alone", () => {
    expect(shouldWelcome({ ...fresh, watchedCount: 1 })).toBe(false);
  });

  it("leaves an account that has picked services alone", () => {
    expect(shouldWelcome({ ...fresh, hasServices: true })).toBe(false);
  });

  it("does nothing while signed out or still resolving", () => {
    expect(shouldWelcome({ ...fresh, userId: null })).toBe(false);
  });
});
