import { describe, expect, it } from "vitest";
import { receiptSegments, receiptsLine } from "@/components/chat/receipts";
import type { HeadshotUIMessage } from "@/lib/agent/events";

type Part = HeadshotUIMessage["parts"][number];

const node = (imdbId: string) =>
  ({
    type: "data-node",
    data: { imdbId, name: imdbId, kind: imdbId.startsWith("nm") ? "person" : "title", titleType: "", year: 0, votes: 0, genres: "", inIndustryGraph: true },
  }) as unknown as Part;
const tool = (name: string, state = "output-available") => ({ type: `tool-${name}`, state }) as unknown as Part;
const text = (t: string) => ({ type: "text", text: t }) as Part;

describe("receipts under an answer", () => {
  it("says nothing when the message carries nothing to show", () => {
    expect(receiptSegments([text("sure.")])).toEqual([]);
    expect(receiptsLine([])).toBe("");
  });

  it("counts the entities the answer actually put on the brain, once each", () => {
    expect(receiptSegments([node("tt1"), node("tt1"), node("nm1"), node("nm2")])).toEqual(["from the graph", "1 title", "2 people"]);
  });

  it("credits the log when one of the v5 taste reads returned", () => {
    expect(receiptSegments([tool("my_profile"), node("tt1")])).toEqual(["from your log", "1 title"]);
    expect(receiptsLine([tool("recall")])).toBe("from your log");
    expect(receiptsLine([tool("have_i_seen")])).toBe("from your log");
    expect(receiptsLine([tool("tonight")])).toBe("from your log");
  });

  it("ignores a tool that has not returned, or failed", () => {
    expect(receiptSegments([tool("my_profile", "input-available")])).toEqual([]);
    expect(receiptSegments([tool("recall", "output-error")])).toEqual([]);
  });

  it("reports a write to the log last", () => {
    expect(receiptSegments([tool("my_profile"), node("tt1"), tool("log")])).toEqual(["from your log", "1 title", "log updated"]);
  });

  it("knows nothing of the tools v5 deleted", () => {
    for (const gone of ["my_taste", "rate", "mark_progress", "tonight_picks", "show_on_brain"]) {
      expect(receiptSegments([tool(gone)])).toEqual([]);
    }
  });

  it("never claims the log for a graph-only answer", () => {
    expect(receiptSegments([tool("shortest_path"), node("nm1")])).toEqual(["from the graph", "1 person"]);
  });
});
