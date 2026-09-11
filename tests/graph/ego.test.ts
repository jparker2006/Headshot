import { describe, it, expect } from "vitest";
import { egoNetwork } from "@/lib/graph/ego";
import { fixtureGraph } from "../agent/helpers";

describe("egoNetwork", () => {
  it("returns the center, its neighbors, and second-ring nodes with edges", async () => {
    const g = await fixtureGraph();
    const hanks = g.idOf("nm0000002")!;
    const ego = egoNetwork(g, hanks, { ring1: 10, ring2Parents: 2, ring2Each: 5 });
    expect(ego.center).toBe("nm0000002");
    const byRing = (r: number) => ego.nodes.filter((n) => n.ring === r).map((n) => n.name).sort();
    expect(byRing(0)).toEqual(["Tom Hanks"]);
    expect(byRing(1)).toEqual(["Apollo 13", "Forrest Gump", "Late Night Show"]);
    // Ring 2 hangs off the two most prominent ring-1 titles.
    expect(byRing(2)).toEqual(expect.arrayContaining(["Gary Sinise", "Kevin Bacon", "Ava Writer"]));
    for (const n of ego.nodes.filter((x) => x.ring === 2)) expect(["tt0000002", "tt0000001"]).toContain(n.parent);
    expect(ego.edges.some((e) => e.personImdbId === "nm0000002" && e.titleImdbId === "tt0000001")).toBe(true);
    // Every edge touches nodes in the network.
    const ids = new Set(ego.nodes.map((n) => n.imdbId));
    for (const e of ego.edges) {
      expect(ids.has(e.personImdbId)).toBe(true);
      expect(ids.has(e.titleImdbId)).toBe(true);
    }
  });
});
