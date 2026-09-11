import { describe, it, expect } from "vitest";
import { egoDefaultFor, egoDelayMs } from "@/components/chat/egoDefault";
import type { HeadshotUIMessage } from "@/lib/agent/events";

type Part = HeadshotUIMessage["parts"][number];
const node = (imdbId: string, kind: "person" | "title") =>
  ({ type: "data-node", data: { imdbId, name: imdbId, kind, titleType: "", year: 0, votes: 0, genres: "", inIndustryGraph: true } }) as Part;
const chosen = (ids: string[]) => ({ type: "data-chosen", data: { from: ids[0], to: ids.at(-1)!, tier: "strong", index: 0, reason: "", path: { imdbIds: ids, names: ids } } }) as Part;
const hop = { type: "data-path-hop", data: { from: "a", to: "b", via: null, index: 0, total: 1, tier: "strong" } } as Part;
const faces = { type: "data-faces", data: { query: "q", candidates: [], total: 0 } } as Part;

describe("ego view by default", () => {
  it("centers on the first person of the chosen path", () => {
    expect(egoDefaultFor([node("tt1", "title"), node("nm9", "person"), chosen(["nm1", "tt1", "nm2"])])).toBe("nm1");
  });
  it("falls back to the first person touched", () => {
    expect(egoDefaultFor([node("tt1", "title"), node("nm5", "person"), node("nm6", "person")])).toBe("nm5");
  });
  it("keeps the whole brain for a face grid without a path", () => {
    expect(egoDefaultFor([node("nm5", "person"), faces])).toBeNull();
    expect(egoDefaultFor([faces, chosen(["nm1", "tt1", "nm2"])])).toBe("nm1");
  });
  it("returns null with nothing to center on", () => {
    expect(egoDefaultFor([{ type: "text", text: "hi" }])).toBeNull();
  });
  it("waits for the path animation", () => {
    expect(egoDelayMs([hop, hop])).toBe(380 * 2 + 900);
    expect(egoDelayMs([])).toBe(300);
  });
});
