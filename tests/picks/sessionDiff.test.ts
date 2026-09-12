import { describe, it, expect } from "vitest";
import { diffLines } from "@/lib/picks/sessionDiff";
import { PINNED_HEADING } from "@/lib/memory";

describe("session diff", () => {
  it("reports added and removed lines, order-insensitively", () => {
    const before = "You like astronauts.\nYou finish series.\nYou avoid horror.";
    const after = "You avoid horror.\nYou like astronauts.\nYou keep coming back to Gary Sinise.";
    expect(diffLines(before, after)).toEqual({
      added: ["You keep coming back to Gary Sinise."],
      removed: ["You finish series."],
    });
  });

  it("is empty when nothing changed but the order", () => {
    const before = "- one\n- two\n- three";
    expect(diffLines(before, "- three\n- one\n- two")).toEqual({ added: [], removed: [] });
  });

  it("ignores headings and blank lines", () => {
    const before = "# What I know\n\nYou like astronauts.\n";
    const after = "## Your taste\n\nYou like astronauts.\n\n";
    expect(diffLines(before, after)).toEqual({ added: [], removed: [] });
  });

  it("ignores the pinned block on both sides", () => {
    const pinned = `${PINNED_HEADING}\nI hate jump scares.`;
    const before = `You like astronauts.\n\n${pinned}`;
    const after = `You like astronauts.\n\n${PINNED_HEADING}\nI hate jump scares.\nAnd musicals.`;
    expect(diffLines(before, after)).toEqual({ added: [], removed: [] });
    // A pinned line is never reported as a belief the model dropped either.
    expect(diffLines(before, "You like astronauts.")).toEqual({ added: [], removed: [] });
  });

  it("is whitespace-insensitive: a re-wrapped line is not a change", () => {
    const before = "  You  like\tastronauts.  ";
    expect(diffLines(before, "You like astronauts.")).toEqual({ added: [], removed: [] });
  });

  it("reads the whole memory as new when there was none", () => {
    expect(diffLines("", "You like astronauts.\nYou finish series.")).toEqual({
      added: ["You like astronauts.", "You finish series."],
      removed: [],
    });
  });
});
