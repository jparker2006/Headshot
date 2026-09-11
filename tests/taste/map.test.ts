import { describe, it, expect } from "vitest";
import { tasteMap, ME } from "@/lib/taste/map";
import { fixtureGraph } from "../agent/helpers";

describe("taste map", () => {
  it("puts you at the center, the people you keep watching on ring 1 with a tone, their rated titles on ring 2", async () => {
    const graph = await fixtureGraph();
    const m = tasteMap(graph, [
      { titleImdbId: "tt0000001", rating: "liked", source: "swipe", watchedAt: null, season: null, episodesWatched: 0, updatedAt: "" },
      { titleImdbId: "tt0000002", rating: "liked", source: "swipe", watchedAt: null, season: null, episodesWatched: 0, updatedAt: "" },
      { titleImdbId: "tt0000003", rating: "meh", source: "swipe", watchedAt: null, season: null, episodesWatched: 0, updatedAt: "" },
      { titleImdbId: "tt0000004", rating: "meh", source: "swipe", watchedAt: null, season: null, episodesWatched: 0, updatedAt: "" },
      { titleImdbId: "tt0000005", rating: "want", source: "swipe", watchedAt: null, season: null, episodesWatched: 0, updatedAt: "" },
    ]);
    expect(m.center).toBe(ME);
    const center = m.nodes.find((n) => n.ring === 0)!;
    expect(center.name).toBe("you");
    const ring1 = m.nodes.filter((n) => n.ring === 1);
    expect(ring1[0]).toMatchObject({ name: "Tom Hanks", count: 3 }); // Apollo 13 + Forrest Gump liked, Late Night Show meh
    expect(ring1.find((n) => n.name === "Gary Sinise")?.count).toBe(2);
    expect(ring1.find((n) => n.name === "Tom Hanks")?.tone).toBe("liked");
    // Gus Guest is only in a meh title (Long Runner): tone meh.
    expect(ring1.find((n) => n.name === "Gus Guest")?.tone).toBe("meh");
    const ring2 = m.nodes.filter((n) => n.ring === 2);
    expect(ring2.map((n) => n.name)).toEqual(expect.arrayContaining(["Apollo 13", "Forrest Gump"]));
    expect(ring2.every((n) => n.parent)).toBe(true);
    // Want-only titles are not on the map; only rated ones.
    expect(m.nodes.map((n) => n.imdbId)).not.toContain("tt0000005");
    expect(m.edges.some((e) => e.personImdbId === ME)).toBe(true);
  });
});
