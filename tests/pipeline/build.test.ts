import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { buildGraph } from "../../scripts/build-graph/build";
import { encodeGraph, decodeGraph, TIER_STRONG, TIER_WEAK, type PackedGraph } from "@/lib/graph/format";

const FIXTURE = path.join(__dirname, "..", "fixtures", "imdb");

function idOf(g: PackedGraph, imdbId: string): number {
  const i = g.header.nodes.imdbId.indexOf(imdbId);
  if (i < 0) throw new Error(`${imdbId} not in graph`);
  return i;
}
function neighborsOf(g: PackedGraph, node: number): { id: number; tier: number }[] {
  const out = [];
  for (let k = g.offsets[node]; k < g.offsets[node + 1]; k++) out.push({ id: g.neighbors[k], tier: g.tiers[k] });
  return out;
}
function edgeTier(g: PackedGraph, a: string, b: string): number | undefined {
  return neighborsOf(g, idOf(g, a)).find((n) => n.id === idOf(g, b))?.tier;
}

describe("build-graph pipeline (fixture seam)", () => {
  let g: PackedGraph;
  beforeAll(async () => {
    g = await buildGraph({ inputDir: FIXTURE, voteFloor: 1000, buildId: "test" });
  });

  it("keeps only allowed title types above the vote floor", () => {
    const ids = new Set(g.header.nodes.imdbId);
    for (const kept of ["tt0000001", "tt0000002", "tt0000003", "tt0000004", "tt0000006", "tt0000009", "tt0000011"]) {
      expect(ids.has(kept), kept).toBe(true);
    }
    expect(ids.has("tt0000005"), "below vote floor").toBe(false);
    expect(ids.has("tt0000007"), "tvEpisode").toBe(false);
    expect(ids.has("tt0000008"), "short").toBe(false);
    expect(ids.has("tt0000010"), "videoGame").toBe(false);
  });

  it("keeps only people with a credit in an allowed category on a kept title", () => {
    const ids = new Set(g.header.nodes.imdbId);
    for (const kept of ["nm0000001", "nm0000002", "nm0000003", "nm0000004", "nm0000005", "nm0000006", "nm0000007", "nm0000008"]) {
      expect(ids.has(kept), kept).toBe(true);
    }
    expect(ids.has("nm0000009"), "only credit is below the floor").toBe(false);
    expect(ids.has("nm0000010"), "producer category").toBe(false);
  });

  it("fills node metadata", () => {
    const apollo = idOf(g, "tt0000001");
    const n = g.header.nodes;
    expect(n.name[apollo]).toBe("Apollo 13");
    expect(n.kind[apollo]).toBe("title");
    expect(n.titleType[apollo]).toBe("movie");
    expect(n.year[apollo]).toBe(1995);
    expect(n.votes[apollo]).toBe(300000);
    expect(n.genres[apollo]).toBe("Adventure,Drama,History");

    const bacon = idOf(g, "nm0000001");
    expect(n.name[bacon]).toBe("Kevin Bacon");
    expect(n.kind[bacon]).toBe("person");
    expect(n.year[bacon]).toBe(1958);
    expect(n.votes[bacon], "max votes among kept titles").toBe(300000);
  });

  it("dedupes multiple credits on the same title into one edge", () => {
    const hanks = idOf(g, "nm0000002");
    const apollo = idOf(g, "tt0000001");
    const count = neighborsOf(g, hanks).filter((n) => n.id === apollo).length;
    expect(count).toBe(1);
    expect(g.header.edgeCount).toBe(19);
  });

  it("tiers: movies, miniseries, tv movies, and short series are strong", () => {
    expect(edgeTier(g, "nm0000001", "tt0000001")).toBe(TIER_STRONG);
    expect(edgeTier(g, "nm0000004", "tt0000006")).toBe(TIER_STRONG);
    expect(edgeTier(g, "nm0000007", "tt0000011")).toBe(TIER_STRONG);
    expect(edgeTier(g, "nm0000005", "tt0000009"), "50-episode series").toBe(TIER_STRONG);
  });

  it("tiers: talk shows and >200-episode series are weak", () => {
    expect(edgeTier(g, "nm0000001", "tt0000003"), "Talk-Show genre").toBe(TIER_WEAK);
    expect(edgeTier(g, "nm0000007", "tt0000004"), "250 episodes").toBe(TIER_WEAK);
  });

  it("stores both directions with sorted neighbor lists", () => {
    for (let v = 0; v < g.header.nodeCount; v++) {
      const ns = neighborsOf(g, v);
      expect(ns.length, `node ${v} has an edge`).toBeGreaterThan(0);
      for (let i = 1; i < ns.length; i++) expect(ns[i].id).toBeGreaterThan(ns[i - 1].id);
      for (const n of ns) expect(neighborsOf(g, n.id).some((m) => m.id === v)).toBe(true);
      const kind = g.header.nodes.kind[v];
      for (const n of ns) expect(g.header.nodes.kind[n.id], "bipartite").not.toBe(kind);
    }
  });

  it("round-trips through the binary container", () => {
    const bytes = encodeGraph(g);
    const back = decodeGraph(bytes);
    expect(back.header).toEqual(g.header);
    expect([...back.offsets]).toEqual([...g.offsets]);
    expect([...back.neighbors]).toEqual([...g.neighbors]);
    expect([...back.tiers]).toEqual([...g.tiers]);
  });

  it("is deterministic across builds", async () => {
    const again = await buildGraph({ inputDir: FIXTURE, voteFloor: 1000, buildId: "test" });
    expect(encodeGraph(again)).toEqual(encodeGraph(g));
  });
});
