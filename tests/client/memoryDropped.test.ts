import { describe, it, expect } from "vitest";
import { droppedLine, droppedParts } from "@/components/you/memoryDropped";

describe("droppedLine", () => {
  it("says nothing when the rewrite dropped nothing", () => {
    expect(droppedLine([])).toBeNull();
    expect(droppedLine(["", "  "])).toBeNull();
  });

  it("names one, two and three titles in the board's voice", () => {
    expect(droppedLine(["The Wire"])).toBe("no longer in your log: **The Wire**");
    expect(droppedLine(["The Wire", "Heat"])).toBe("no longer in your log: **The Wire** and **Heat**");
    expect(droppedLine(["The Wire", "Heat", "Alien"])).toBe("no longer in your log: **The Wire**, **Heat** and **Alien**");
  });

  it("counts the tail rather than listing a wall", () => {
    expect(droppedLine(["A", "B", "C", "D", "E"])).toBe("no longer in your log: **A**, **B**, **C** and 2 more");
  });

  it("is lowercase-led, like every other meta line", () => {
    expect(droppedLine(["Heat"])!.startsWith("no longer")).toBe(true);
  });
});

describe("droppedParts", () => {
  it("marks the titles and nothing else", () => {
    expect(droppedParts(["Heat", "Alien"])).toEqual([
      { text: "no longer in your log: ", bold: false },
      { text: "Heat", bold: true },
      { text: " and ", bold: false },
      { text: "Alien", bold: true },
    ]);
  });

  it("is empty when there is no line", () => {
    expect(droppedParts([])).toEqual([]);
  });
});
