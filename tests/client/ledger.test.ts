import { describe, expect, it } from "vitest";
import { barClass, barRank, barWidth, rowInk } from "@/components/you/ledger";
import { memoryBlocks } from "@/components/you/MemoryProse";

describe("ledger bars", () => {
  it("is the datum as a share of the block's peak", () => {
    expect(barWidth(22, 22)).toBe("100%");
    expect(barWidth(11, 22)).toBe("50%");
  });

  it("never draws a real datum as nothing, and never draws a zero", () => {
    expect(barWidth(1, 500)).toBe("2%");
    expect(barWidth(0, 22)).toBe("0%");
    expect(barWidth(5, 0)).toBe("0%");
    expect(barWidth(Number.NaN, 10)).toBe("0%");
  });

  it("ranks by position: the top one or two carry the block, the last is the tail", () => {
    expect([0, 1, 2, 3].map((i) => barRank(i, 4))).toEqual(["strong", "strong", "base", "weak"]);
    expect([0, 1].map((i) => barRank(i, 2))).toEqual(["strong", "weak"]);
    expect(barRank(0, 1)).toBe("strong");
  });

  it("says the rank in classes, with the base alpha unnamed", () => {
    expect(barClass("base")).toBe("ledger-bar");
    expect(barClass("strong")).toBe("ledger-bar ledger-bar-strong");
    expect(barClass("weak")).toBe("ledger-bar ledger-bar-weak");
  });

  it("puts the rows that carry a block at full ink", () => {
    expect(rowInk(0, 4)).toBe("text-ink");
    expect(rowInk(3, 4)).toBe("text-ink-dim");
  });
});

describe("memory blocks", () => {
  const markdown = [
    "## What you love",
    "**Star Wars**, all of it.",
    "",
    "## Notes",
    '"I like movies."',
  ].join("\n");

  it("reads the rewrite job's headings back in the board's lowercase", () => {
    expect(memoryBlocks(markdown)[0]).toEqual({ kind: "heading", text: "what you love", first: true });
  });

  it("marks the notes section so it can be quoted back at .t-note", () => {
    const blocks = memoryBlocks(markdown);
    expect(blocks.filter((b) => b.kind === "line").map((b) => b.note)).toEqual([false, true]);
  });

  it("drops blank lines and list markers, and only the first heading is first", () => {
    const blocks = memoryBlocks("## A\n- one\n\n## B\n* two");
    expect(blocks).toEqual([
      { kind: "heading", text: "a", first: true },
      { kind: "line", text: "one", note: false },
      { kind: "heading", text: "b", first: false },
      { kind: "line", text: "two", note: false },
    ]);
  });

  it("says nothing for an empty memory", () => {
    expect(memoryBlocks("   \n\n")).toEqual([]);
  });
});
