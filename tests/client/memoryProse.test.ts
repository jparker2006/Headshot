import { describe, expect, it } from "vitest";
import { memoryBlocks } from "@/components/you/MemoryProse";

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
