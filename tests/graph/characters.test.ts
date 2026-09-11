import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { buildGraph } from "../../scripts/build-graph/build";
import { loadCachedCredits } from "../../scripts/build-graph/tmdb";
import { IndustryGraph, TIER_STRONG, TIER_WEAK, type PackedGraph } from "@/lib/graph";

const IMDB = path.join(__dirname, "..", "fixtures", "imdb");
const TMDB = path.join(__dirname, "..", "fixtures", "tmdb");

const HANKS = "nm0000002";
const SINISE = "nm0000004";
const JANE = "nm0000005";
const GUEST = "nm0000099";
const APOLLO = "tt0000001";
const GUMP = "tt0000002";
const GOOD_SERIES = "tt0000009";

let packed: PackedGraph;
let g: IndustryGraph;
const id = (imdbId: string) => g.idOf(imdbId)!;

beforeAll(async () => {
  packed = await buildGraph({ inputDir: IMDB, voteFloor: 1000, buildId: "test", tmdb: loadCachedCredits(TMDB) });
  g = new IndustryGraph(packed);
});

describe("packed characters (v2 fixture seam)", () => {
  it("returns the character for a known credit", () => {
    expect(g.character(id(HANKS), id(APOLLO))).toBe("Jim Lovell");
    expect(g.character(id(HANKS), id(GUMP))).toBe("Forrest Gump");
    expect(g.character(id(JANE), id(GUMP))).toBe("Young Jenny");
    expect(g.character(id(GUEST), id(APOLLO))).toBe("Flight Surgeon");
  });

  it("returns null for a credit TMDB did not cover and for non-edges", () => {
    expect(g.character(id(SINISE), id(APOLLO)), "principal missing from the TMDB cast").toBeNull();
    expect(g.character(id(HANKS), id(GOOD_SERIES)), "not an edge at all").toBeNull();
    expect(g.character(id(JANE), id(APOLLO)), "not an edge at all").toBeNull();
  });

  it("exposes tmdb ids on nodes that have them", () => {
    expect(g.nodeByImdbId(HANKS)!.tmdbId).toBe(31);
    expect(g.nodeByImdbId(APOLLO)!.tmdbId).toBe(568);
    expect(g.nodeByImdbId(GOOD_SERIES)!.tmdbId).toBeUndefined();
  });

  it("castOf lists a title's cast with tiers and characters, most prominent first", () => {
    const cast = g.castOf(id(APOLLO));
    expect(cast.map((c) => [c.node.imdbId, c.tier, c.character])).toContainEqual([HANKS, TIER_STRONG, "Jim Lovell"]);
    expect(cast.map((c) => [c.node.imdbId, c.tier, c.character])).toContainEqual([GUEST, TIER_WEAK, "Flight Surgeon"]);
    expect(cast.map((c) => [c.node.imdbId, c.tier, c.character])).toContainEqual([SINISE, TIER_STRONG, null]);
    for (let i = 1; i < cast.length; i++) {
      expect(cast[i - 1].node.votes >= cast[i].node.votes).toBe(true);
    }
  });

  it("castOf from a person's side names the character on each title", () => {
    const credits = g.castOf(id(HANKS));
    const gump = credits.find((c) => c.node.imdbId === GUMP)!;
    expect(gump.character).toBe("Forrest Gump");
    expect(gump.tier).toBe(TIER_STRONG);
  });

  it("returns null for overlay edges", () => {
    const withOverlay = new IndustryGraph(packed, {
      nodes: [{ imdbId: "nm0000777", name: "Overlay Person", kind: "person" }],
      edges: [{ personImdbId: "nm0000777", titleImdbId: APOLLO, tier: TIER_WEAK }],
    });
    const overlayPerson = withOverlay.idOf("nm0000777")!;
    expect(withOverlay.character(overlayPerson, withOverlay.idOf(APOLLO)!)).toBeNull();
    const cast = withOverlay.castOf(withOverlay.idOf(APOLLO)!);
    expect(cast.find((c) => c.node.imdbId === "nm0000777")!.character).toBeNull();
  });
});
