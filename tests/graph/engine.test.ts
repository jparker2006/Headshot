import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { buildGraph } from "../../scripts/build-graph/build";
import { IndustryGraph, TIER_STRONG, type PackedGraph } from "@/lib/graph";

const FIXTURE = path.join(__dirname, "..", "fixtures", "imdb");

const BACON = "nm0000001";
const HANKS = "nm0000002";
const PAXTON = "nm0000003";
const SINISE = "nm0000004";
const JANE = "nm0000005";
const WES = "nm0000006";
const GUS = "nm0000007";
const APOLLO = "tt0000001";
const GUMP = "tt0000002";
const LATE_NIGHT = "tt0000003";
const GOOD_SERIES = "tt0000009";

let packed: PackedGraph;
let g: IndustryGraph;

function names(g: IndustryGraph, ids: number[]): string[] {
  return ids.map((id) => g.node(id).name);
}

beforeAll(async () => {
  packed = await buildGraph({ inputDir: FIXTURE, voteFloor: 1000, buildId: "test" });
  g = new IndustryGraph(packed);
});

describe("graph engine (fixture seam)", () => {
  it("resolves nodes by IMDb id and exposes metadata", () => {
    const bacon = g.nodeByImdbId(BACON)!;
    expect(bacon.name).toBe("Kevin Bacon");
    expect(bacon.kind).toBe("person");
    expect(bacon.overlay).toBe(false);
    expect(g.nodeByImdbId("nm9999999")).toBeUndefined();
  });

  it("finds the direct co-star path with Bacon number 1", () => {
    const r = g.tieredPaths(g.idOf(BACON)!, g.idOf(SINISE)!);
    expect(r.full?.distance).toBe(2);
    expect(r.full?.baconNumber).toBe(1);
    expect(names(g, r.full!.paths[0])).toEqual(["Kevin Bacon", "Apollo 13", "Gary Sinise"]);
    expect(r.differ).toBe(false);
  });

  it("enumerates every tied shortest path", () => {
    const r = g.shortestPaths(g.idOf(HANKS)!, g.idOf(SINISE)!, "all")!;
    expect(r.baconNumber).toBe(1);
    expect(r.paths.map((p) => names(g, p)[1]).sort()).toEqual(["Apollo 13", "Forrest Gump"]);
    expect(r.truncated).toBe(false);
  });

  it("caps tied paths and reports truncation", () => {
    const r = g.shortestPaths(g.idOf(HANKS)!, g.idOf(SINISE)!, "all", { maxPaths: 1 })!;
    expect(r.paths).toHaveLength(1);
    expect(r.truncated).toBe(true);
  });

  it("runs strong tier first and reports when the true Bacon number is shorter via weak edges", () => {
    // Jane -> Bacon: 1 via the talk show (weak), 2 via Good Series -> Paxton -> Apollo 13 (strong).
    const r = g.tieredPaths(g.idOf(JANE)!, g.idOf(BACON)!);
    expect(r.full?.baconNumber).toBe(1);
    expect(names(g, r.full!.paths[0])).toEqual(["Jane Doe", "Late Night Show", "Kevin Bacon"]);
    expect(r.strong?.baconNumber).toBe(2);
    expect(names(g, r.strong!.paths[0])).toEqual(["Jane Doe", "Good Series", "Bill Paxton", "Apollo 13", "Kevin Bacon"]);
    expect(r.differ).toBe(true);
  });

  it("finds a strong path that avoids the 250-episode series", () => {
    // Gus -> Hanks strong: Gus -> TV Movie -> Wes -> Apollo 13 -> Hanks.
    const r = g.tieredPaths(g.idOf(GUS)!, g.idOf(HANKS)!);
    expect(r.strong?.baconNumber).toBe(2);
    expect(names(g, r.strong!.paths[0])).toEqual(["Gus Guest", "TV Movie", "Wes Director", "Apollo 13", "Tom Hanks"]);
    // Full graph ties at 2 (also via Long Runner -> Paxton -> Apollo 13).
    expect(r.full?.baconNumber).toBe(2);
    expect(r.full!.paths.length).toBe(2);
    expect(r.differ).toBe(false);
  });

  it("returns null for the strong tier when only weak edges connect", () => {
    // Every edge on Late Night Show is weak; Late Night Show -> anything strong-only is unreachable.
    const r = g.shortestPaths(g.idOf(LATE_NIGHT)!, g.idOf(BACON)!, "strong");
    expect(r).toBeNull();
    expect(g.shortestPaths(g.idOf(LATE_NIGHT)!, g.idOf(BACON)!, "all")?.distance).toBe(1);
  });

  it("respects maxDepth", () => {
    const r = g.shortestPaths(g.idOf(JANE)!, g.idOf(BACON)!, "strong", { maxDepth: 2 });
    expect(r).toBeNull();
  });

  it("returns a zero-length path for identical endpoints", () => {
    const r = g.shortestPaths(g.idOf(BACON)!, g.idOf(BACON)!, "all")!;
    expect(r.distance).toBe(0);
    expect(r.baconNumber).toBe(0);
  });

  it("computes common neighbors and shared credits", () => {
    expect(names(g, g.commonNeighbors(g.idOf(APOLLO)!, g.idOf(GUMP)!).map((n) => n.id))).toEqual(["Gary Sinise", "Tom Hanks"]);
    expect(names(g, g.sharedCredits(g.idOf(HANKS)!, g.idOf(SINISE)!).map((n) => n.id))).toEqual(["Forrest Gump", "Apollo 13"]);
    expect(g.sharedCredits(g.idOf(PAXTON)!, g.idOf(WES)!).map((n) => n.name)).toEqual(["Apollo 13"]);
    expect(g.sharedCredits(g.idOf(JANE)!, g.idOf(SINISE)!)).toEqual([]);
  });

  it("searches by name: exact first, then substring ranked by votes", () => {
    expect(g.searchByName("kevin bacon").map((n) => n.name)).toEqual(["Kevin Bacon"]);
    expect(g.searchByName("Tom")[0].name).toBe("Tom Hanks");
    expect(g.searchByName("series", 10, "title").map((n) => n.name)).toEqual(["Mini Series", "Good Series"]);
    expect(g.searchByName("")).toEqual([]);
  });

  it("lists a neighborhood sorted by votes", () => {
    const hood = g.neighborhood(g.idOf(HANKS)!);
    expect(hood.map((h) => h.node.name)).toEqual(["Forrest Gump", "Apollo 13", "Late Night Show"]);
    expect(hood[0].tier).toBe(TIER_STRONG);
  });
});

describe("graph engine with overlay", () => {
  it("lets live-discovered nodes and edges participate in path finding", () => {
    const withOverlay = new IndustryGraph(packed, {
      nodes: [{ imdbId: "nm0009999", name: "Newbie Actor", kind: "person" }],
      edges: [{ personImdbId: "nm0009999", titleImdbId: APOLLO, tier: TIER_STRONG }],
    });
    const newbie = withOverlay.idOf("nm0009999")!;
    expect(withOverlay.node(newbie).overlay).toBe(true);
    const r = withOverlay.tieredPaths(newbie, withOverlay.idOf(BACON)!);
    expect(r.full?.baconNumber).toBe(1);
    expect(names(withOverlay, r.full!.paths[0])).toEqual(["Newbie Actor", "Apollo 13", "Kevin Bacon"]);
    expect(withOverlay.searchByName("newbie")[0].imdbId).toBe("nm0009999");
  });

  it("supports overlay titles connecting existing people", () => {
    const withOverlay = new IndustryGraph(packed, {
      nodes: [{ imdbId: "tt0009999", name: "New Indie", kind: "title", titleType: "movie", year: 2025 }],
      edges: [
        { personImdbId: JANE, titleImdbId: "tt0009999", tier: TIER_STRONG },
        { personImdbId: SINISE, titleImdbId: "tt0009999", tier: TIER_STRONG },
      ],
    });
    const r = withOverlay.shortestPaths(withOverlay.idOf(JANE)!, withOverlay.idOf(SINISE)!, "strong")!;
    expect(r.baconNumber).toBe(1);
    expect(names(withOverlay, r.paths[0])).toEqual(["Jane Doe", "New Indie", "Gary Sinise"]);
    expect(withOverlay.sharedCredits(withOverlay.idOf(JANE)!, withOverlay.idOf(SINISE)!).map((n) => n.name)).toEqual(["New Indie"]);
  });

  it("ignores overlay edges that duplicate packed edges and can be replaced", () => {
    const withOverlay = new IndustryGraph(packed, {
      nodes: [],
      edges: [{ personImdbId: BACON, titleImdbId: APOLLO, tier: TIER_STRONG }],
    });
    expect(withOverlay.degree(withOverlay.idOf(BACON)!)).toBe(g.degree(g.idOf(BACON)!));
    withOverlay.setOverlay({
      nodes: [{ imdbId: "nm0009998", name: "Replacement", kind: "person" }],
      edges: [{ personImdbId: "nm0009998", titleImdbId: GOOD_SERIES, tier: TIER_STRONG }],
    });
    expect(withOverlay.nodeByImdbId("nm0009998")).toBeDefined();
    expect(withOverlay.nodeCount).toBe(packed.header.nodeCount + 1);
  });

  it("returns null when an overlay node is disconnected", () => {
    const withOverlay = new IndustryGraph(packed, {
      nodes: [{ imdbId: "nm0009997", name: "Island", kind: "person" }],
      edges: [],
    });
    expect(withOverlay.tieredPaths(withOverlay.idOf("nm0009997")!, withOverlay.idOf(BACON)!).full).toBeNull();
  });
});
