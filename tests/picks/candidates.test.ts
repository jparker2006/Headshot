import { describe, it, expect } from "vitest";
import { TmdbClient } from "@/lib/tmdb/client";
import { buildCandidates } from "@/lib/picks/candidates";
import { fixtureGraph } from "../agent/helpers";

const APOLLO = "tt0000001";
const GUMP = "tt0000002";
const HULU = 15;

/** A TMDB that knows Forrest Gump (tmdb 13) streams on Hulu and takes 142 minutes; everything else is unknown. */
function fakeTmdb(calls: string[]) {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.pathname === `/3/find/${GUMP}`) return json({ movie_results: [{ id: 13 }], tv_results: [], person_results: [] });
    if (url.pathname.startsWith("/3/find/")) return json({ movie_results: [], tv_results: [], person_results: [] });
    if (url.pathname === "/3/movie/13/watch/providers")
      return json({ results: { US: { link: "https://www.themoviedb.org/movie/13/watch?locale=US", flatrate: [{ provider_id: HULU, provider_name: "Hulu", logo_path: "/h.png" }], rent: [] } } });
    if (url.pathname === "/3/movie/13") return json({ id: 13, runtime: 142, poster_path: "/gump.jpg", vote_average: 8.8, vote_count: 1000, overview: "", genres: [] });
    if (url.pathname.startsWith("/3/discover/")) return json({ results: [] });
    return json({}, 404);
  };
  return new TmdbClient({ bearerToken: "test", fetch: fetchImpl });
}

describe("candidate pool", () => {
  it("walks the graph and merges availability, link, runtime, and poster from TMDB", async () => {
    const graph = await fixtureGraph();
    const calls: string[] = [];
    const pool = await buildCandidates({ graph, tmdb: fakeTmdb(calls), watched: [{ imdbId: APOLLO, rating: "rated", score: 8 }], services: [HULU] });
    const gump = pool.candidates.find((c) => c.imdbId === GUMP)!;
    expect(gump.availableOn).toEqual([HULU]);
    expect(gump.runtimeMin).toBe(142);
    expect(gump.fresh).toBe(false);
    const meta = pool.meta.get(GUMP)!;
    expect(meta.link).toContain("/movie/13/watch");
    expect(meta.posterUrl).toContain("/gump.jpg");
    expect(meta.providers[0]).toMatchObject({ id: HULU, name: "Hulu" });
    // Discover ran for both media types on the user's providers.
    expect(calls.filter((p) => p.startsWith("/3/discover/"))).toHaveLength(2);
    // Titles TMDB does not know stay in the pool with unknown availability.
    const unknown = pool.candidates.find((c) => c.imdbId !== GUMP)!;
    expect(unknown.availableOn).toEqual([]);
  });

  it("works without TMDB: graph walk only, nothing available", async () => {
    const graph = await fixtureGraph();
    const pool = await buildCandidates({ graph, tmdb: null, watched: [{ imdbId: APOLLO, rating: "rated", score: 8 }], services: [HULU] });
    expect(pool.candidates.length).toBeGreaterThan(0);
    expect(pool.candidates.every((c) => c.availableOn.length === 0)).toBe(true);
    expect(pool.candidates.map((c) => c.imdbId)).not.toContain(APOLLO);
  });
});
