import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { buildGraph } from "../../scripts/build-graph/build";
import { loadCachedCredits } from "../../scripts/build-graph/tmdb";
import { decodeGraph, encodeGraph, TIER_STRONG, TIER_WEAK, type PackedGraph } from "@/lib/graph/format";

const IMDB = path.join(__dirname, "..", "fixtures", "imdb");
const TMDB = path.join(__dirname, "..", "fixtures", "tmdb");

const APOLLO = "tt0000001";
const GUMP = "tt0000002";
const HANKS = "nm0000002";
const SINISE = "nm0000004";
const JANE = "nm0000005";
const GUEST = "nm0000099";
const NAMELESS = "tm9003";

function idOf(g: PackedGraph, imdbId: string): number {
  const i = g.header.nodes.imdbId.indexOf(imdbId);
  if (i < 0) throw new Error(`${imdbId} not in graph`);
  return i;
}
function edge(g: PackedGraph, a: string, b: string): { tier: number; character: string } | undefined {
  const from = idOf(g, a);
  const to = idOf(g, b);
  for (let k = g.offsets[from]; k < g.offsets[from + 1]; k++) {
    if (g.neighbors[k] !== to) continue;
    return { tier: g.tiers[k], character: g.header.characters![g.chars![k]] };
  }
  return undefined;
}

describe("tmdb crawl stage (fixture seam)", () => {
  let g: PackedGraph;
  beforeAll(async () => {
    g = await buildGraph({ inputDir: IMDB, voteFloor: 1000, buildId: "test", tmdb: loadCachedCredits(TMDB) });
  });

  it("reads a cached crawl without touching the network", () => {
    const credits = loadCachedCredits(TMDB);
    expect([...credits.keys()].sort()).toEqual([APOLLO, GUMP]);
    expect(credits.get(APOLLO)!.tmdbId).toBe(568);
    expect(credits.get(APOLLO)!.cast).toHaveLength(5);
    expect(credits.has("tt0000005"), "cached 404 marker is skipped").toBe(false);
  });

  it("keeps an existing principal's tier and gives it a character", () => {
    expect(edge(g, HANKS, APOLLO)).toEqual({ tier: TIER_STRONG, character: "Jim Lovell" });
    expect(edge(g, HANKS, GUMP)).toEqual({ tier: TIER_STRONG, character: "Forrest Gump" });
    expect(edge(g, SINISE, GUMP)).toEqual({ tier: TIER_STRONG, character: "Lieutenant Dan" });
  });

  it("adds a weak edge for a graph person who was not a principal on the title", () => {
    expect(edge(g, JANE, GUMP)).toEqual({ tier: TIER_WEAK, character: "Young Jenny" });
    // Both directions carry the same character.
    expect(edge(g, GUMP, JANE)).toEqual({ tier: TIER_WEAK, character: "Young Jenny" });
  });

  it("leaves an IMDb credit TMDB did not list without a character", () => {
    expect(edge(g, SINISE, APOLLO)).toEqual({ tier: TIER_STRONG, character: "" });
  });

  it("adds new people with their TMDB ids, interleaved in the name sort", () => {
    const n = g.header.nodes;
    const guest = idOf(g, GUEST);
    expect(n.name[guest]).toBe("Guest Star");
    expect(n.kind[guest]).toBe("person");
    expect(n.year[guest]).toBe(0);
    expect(n.votes[guest], "the title's votes").toBe(300000);
    expect(n.tmdbId![guest]).toBe(9002);
    expect(edge(g, GUEST, APOLLO)).toEqual({ tier: TIER_WEAK, character: "Flight Surgeon" });

    const nameless = idOf(g, NAMELESS);
    expect(n.name[nameless]).toBe("Nameless Extra");
    expect(n.tmdbId![nameless]).toBe(9003);
    expect(edge(g, NAMELESS, APOLLO)).toEqual({ tier: TIER_WEAK, character: "Technician" });

    // People are still sorted by name across old and new nodes.
    const people = n.name.filter((_, i) => n.kind[i] === "person");
    expect([...people].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(people);
  });

  it("sets tmdb ids on crawled titles and matched people", () => {
    const n = g.header.nodes;
    expect(n.tmdbId![idOf(g, APOLLO)]).toBe(568);
    expect(n.tmdbId![idOf(g, GUMP)]).toBe(13);
    expect(n.tmdbId![idOf(g, HANKS)]).toBe(31);
    expect(n.tmdbId![idOf(g, "tt0000009")], "not crawled").toBe(0);
    expect(n.tmdbId![idOf(g, "nm0000007")], "not in any crawled cast").toBe(0);
  });

  it("keeps the character table small and zero-indexed at empty", () => {
    expect(g.header.characters![0]).toBe("");
    expect(new Set(g.header.characters).size).toBe(g.header.characters!.length);
    expect(g.header.tmdb).toEqual({ titlesCrawled: 2, castCap: 40 });
    expect(g.chars!.length).toBe(g.header.edgeCount * 2);
  });

  it("round-trips v2 through the binary container", () => {
    const back = decodeGraph(encodeGraph(g));
    expect(back.header).toEqual(g.header);
    expect([...back.offsets]).toEqual([...g.offsets]);
    expect([...back.neighbors]).toEqual([...g.neighbors]);
    expect([...back.tiers]).toEqual([...g.tiers]);
    expect([...back.chars!]).toEqual([...g.chars!]);
  });

  it("is deterministic across builds", async () => {
    const again = await buildGraph({ inputDir: IMDB, voteFloor: 1000, buildId: "test", tmdb: loadCachedCredits(TMDB) });
    expect(encodeGraph(again)).toEqual(encodeGraph(g));
  });

  it("still decodes a version 1 file", async () => {
    const v1 = await buildGraph({ inputDir: IMDB, voteFloor: 1000, buildId: "test" });
    const bytes = encodeGraph(v1);
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(4, 1, true);
    const back = decodeGraph(bytes);
    expect(back.chars).toBeUndefined();
    expect(back.header.characters).toBeUndefined();
    expect(back.header.nodes.tmdbId).toBeUndefined();
    expect([...back.neighbors]).toEqual([...v1.neighbors]);
    expect([...back.tiers]).toEqual([...v1.tiers]);
  });
});
