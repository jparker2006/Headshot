import { describe, expect, it } from "vitest";
import {
  UNDONE_MS,
  UNDO_MS,
  initialLogField,
  logFieldReducer,
  loggedLine,
  stepTimeout,
  type LogFieldState,
} from "@/components/log/logFieldState";

const run = (events: Parameters<typeof logFieldReducer>[1][], from: LogFieldState = initialLogField) =>
  events.reduce(logFieldReducer, from);

describe("the log field's state machine", () => {
  it("starts idle", () => {
    expect(initialLogField).toEqual({ step: "idle" });
  });

  it("goes idle → picked → logged → idle", () => {
    const picked = run([{ type: "pick", imdbId: "tt1" }]);
    expect(picked).toEqual({ step: "picked", imdbId: "tt1" });
    const logged = logFieldReducer(picked, { type: "logged", imdbId: "tt1", line: "logged Heat 9" });
    expect(logged).toEqual({ step: "logged", imdbId: "tt1", line: "logged Heat 9" });
    expect(logFieldReducer(logged, { type: "expire" })).toEqual({ step: "idle" });
  });

  it("cancels a pick and nothing else", () => {
    expect(run([{ type: "pick", imdbId: "tt1" }, { type: "cancel" }])).toEqual({ step: "idle" });
    const logged = run([
      { type: "pick", imdbId: "tt1" },
      { type: "logged", imdbId: "tt1", line: "logged Heat 9" },
      { type: "cancel" },
    ]);
    expect(logged.step).toBe("logged");
  });

  it("undoes a logged row into `undone`, which then falls back to idle", () => {
    const undone = run([
      { type: "pick", imdbId: "tt1" },
      { type: "logged", imdbId: "tt1", line: "logged Heat 9" },
      { type: "undo" },
    ]);
    expect(undone).toEqual({ step: "undone" });
    expect(logFieldReducer(undone, { type: "expire" })).toEqual({ step: "idle" });
  });

  it("ignores an undo that has nothing to undo", () => {
    expect(logFieldReducer({ step: "idle" }, { type: "undo" })).toEqual({ step: "idle" });
    expect(logFieldReducer({ step: "picked", imdbId: "tt1" }, { type: "undo" })).toEqual({ step: "picked", imdbId: "tt1" });
  });

  it("lets a new pick replace whatever was on screen", () => {
    const next = run([
      { type: "pick", imdbId: "tt1" },
      { type: "logged", imdbId: "tt1", line: "logged Heat 9" },
      { type: "pick", imdbId: "tt2" },
    ]);
    expect(next).toEqual({ step: "picked", imdbId: "tt2" });
  });

  it("waits ten seconds on the undo line and two on `undone`", () => {
    expect(UNDO_MS).toBe(10_000);
    expect(UNDONE_MS).toBe(2_000);
    expect(stepTimeout({ step: "logged", imdbId: "tt1", line: "x" })).toBe(UNDO_MS);
    expect(stepTimeout({ step: "undone" })).toBe(UNDONE_MS);
    expect(stepTimeout({ step: "idle" })).toBeNull();
    expect(stepTimeout({ step: "picked", imdbId: "tt1" })).toBeNull();
  });
});

describe("loggedLine", () => {
  it("says the title and the score", () => {
    expect(loggedLine({ rating: "rated", score: 9 }, "Heat")).toBe("logged Heat 9");
    expect(loggedLine({ rating: "rated", score: 9.7 }, "Heat")).toBe("logged Heat 9.7");
  });

  it("says the state word when nobody put a number on it", () => {
    expect(loggedLine({ rating: "want", score: null }, "Heat")).toBe("logged Heat want");
    expect(loggedLine({ rating: "seen", score: null }, "Heat")).toBe("logged Heat seen");
    expect(loggedLine({ rating: "unseen", score: null }, "Heat")).toBe("logged Heat not seen");
  });

  it("never leaves a hole where the title should be", () => {
    expect(loggedLine({ rating: "rated", score: 8 }, "  ")).toBe("logged that 8");
  });
});
