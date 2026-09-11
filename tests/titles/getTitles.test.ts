import { describe, expect, it } from "vitest";
import { getTitles, MemoryTitlesStore, posterUrl, type TitleLookup, type TitleRow } from "@/lib/titles";
import { TmdbClient } from "@/lib/tmdb/client";
import type { NodeInfo } from "@/lib/graph/engine";

/** The two ids the fake TMDB knows, plus one it does not. */
const HEAT = "tt0113277";
const SOPRANOS = "tt0141842";
const UNKNOWN = "tt9999999";
const BOOM = "tt5555555";

function node(partial: Partial<NodeInfo>): NodeInfo {
  return { id: 0, imdbId: "", name: "", kind: "title", titleType: "movie", year: 0, votes: 0, genres: "", overlay: false, ...partial };
}

const graph: TitleLookup = {
  nodeByImdbId(imdbId) {
    const rows: Record<string, NodeInfo> = {
      [HEAT]: node({ imdbId: HEAT, name: "Heat", titleType: "movie", year: 1995, genres: "Crime,Drama", tmdbId: 949 }),
      [SOPRANOS]: node({ imdbId: SOPRANOS, name: "The Sopranos", titleType: "tvSeries", year: 1999, genres: "Drama" }),
      [UNKNOWN]: node({ imdbId: UNKNOWN, name: "Tiny Indie", titleType: "movie", year: 2021 }),
      [BOOM]: node({ imdbId: BOOM, name: "Broken", titleType: "movie", year: 2001 }),
    };
    return rows[imdbId];
  },
};

/** A TMDB that answers from fixtures, counts calls, and can be told to fail. */
function fakeTmdb() {
  const calls: string[] = [];
  let inFlight = 0;
  let peak = 0;
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url.replace("https://api.themoviedb.org/3", ""));
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;

    if (url.includes(`/find/${BOOM}`)) return new Response("nope", { status: 500 });
    if (url.includes(`/find/${HEAT}`)) return json({ movie_results: [{ id: 949 }], tv_results: [], person_results: [] });
    if (url.includes(`/find/${SOPRANOS}`)) return json({ movie_results: [], tv_results: [{ id: 1398 }], person_results: [] });
    if (url.includes("/find/")) return json({ movie_results: [], tv_results: [], person_results: [] });
    if (url.includes("/movie/949/watch/providers"))
      return json({ results: { US: { link: "https://tmdb/movie/949/watch", flatrate: [{ provider_id: 8, provider_name: "Netflix" }] } } });
    if (url.includes("/tv/1398/watch/providers")) return json({ results: {} });
    if (url.includes("/movie/949"))
      return json({ id: 949, title: "Heat", release_date: "1995-12-15", runtime: 170, genres: [{ name: "Crime" }, { name: "Drama" }], poster_path: "/heat.jpg" });
    if (url.includes("/tv/1398"))
      return json({
        id: 1398,
        name: "The Sopranos",
        first_air_date: "1999-01-10",
        episode_run_time: [50, 60],
        genres: [{ name: "Drama" }],
        poster_path: "/sopranos.jpg",
        seasons: [
          { season_number: 2, episode_count: 13 },
          { season_number: 0, episode_count: 5 },
          { season_number: 1, episode_count: 13 },
        ],
      });
    return json({});
  }) as typeof fetch;

  return { client: new TmdbClient({ bearerToken: "test", fetch: fetchImpl }), calls, peak: () => peak };
}

const now = () => new Date("2026-09-11T10:00:00.000Z");

describe("getTitles", () => {
  it("fills a miss from the graph and then from TMDB, and stores the row", async () => {
    const store = new MemoryTitlesStore();
    const tmdb = fakeTmdb();
    const got = await getTitles([HEAT], { store, tmdb: tmdb.client, graph, now });

    expect(got.get(HEAT)).toEqual<TitleRow>({
      imdbId: HEAT,
      tmdbId: 949,
      kind: "movie",
      name: "Heat",
      year: 1995,
      runtime: 170,
      seasons: null,
      genres: ["Crime", "Drama"],
      posterPath: "/heat.jpg",
      providers: { link: "https://tmdb/movie/949/watch", flatrate: [{ id: 8, name: "Netflix", logoUrl: undefined }], rent: [], buy: [], ads: [] },
      fetchedAt: "2026-09-11T10:00:00.000Z",
    });
    expect(posterUrl(got.get(HEAT))).toBe("https://image.tmdb.org/t/p/w342/heat.jpg");
    expect((await store.getMany([HEAT])).get(HEAT)?.runtime).toBe(170);
  });

  it("a cached row costs no TMDB call", async () => {
    const store = new MemoryTitlesStore();
    const first = fakeTmdb();
    await getTitles([HEAT], { store, tmdb: first.client, graph, now });

    const second = fakeTmdb();
    const got = await getTitles([HEAT, "nm0000102", "garbage"], { store, tmdb: second.client, graph, now });
    expect(second.calls).toEqual([]);
    // Person ids and junk never reach the titles cache.
    expect([...got.keys()]).toEqual([HEAT]);
  });

  it("a series carries its seasons with episode counts and the average episode runtime", async () => {
    const store = new MemoryTitlesStore();
    const tmdb = fakeTmdb();
    const row = (await getTitles([SOPRANOS], { store, tmdb: tmdb.client, graph, now })).get(SOPRANOS)!;
    expect(row.kind).toBe("series");
    expect(row.runtime).toBe(55);
    // Specials (season 0) are dropped; the rest come back in order.
    expect(row.seasons).toEqual([
      { season: 1, episodes: 13 },
      { season: 2, episodes: 13 },
    ]);
    // No providers block in this region is a fact, not a failure.
    expect(row.providers).toBeNull();
    expect(row.fetchedAt).toBe("2026-09-11T10:00:00.000Z");
  });

  it("a TMDB failure returns the graph-only row with a null fetchedAt, and retries next time", async () => {
    const store = new MemoryTitlesStore();
    const tmdb = fakeTmdb();
    const got = await getTitles([BOOM, UNKNOWN], { store, tmdb: tmdb.client, graph, now });

    expect(got.get(BOOM)).toMatchObject({ name: "Broken", year: 2001, kind: "movie", runtime: null, fetchedAt: null });
    // TMDB simply does not know the other id; same treatment.
    expect(got.get(UNKNOWN)).toMatchObject({ name: "Tiny Indie", fetchedAt: null });
    expect((await store.getMany([BOOM, UNKNOWN])).size).toBe(2);

    const again = fakeTmdb();
    await getTitles([BOOM], { store, tmdb: again.client, graph, now });
    expect(again.calls.some((c) => c.includes(`/find/${BOOM}`))).toBe(true);
  });

  it("without a TMDB client the graph half is still answered", async () => {
    const store = new MemoryTitlesStore();
    const got = await getTitles([HEAT, SOPRANOS], { store, tmdb: null, graph, now });
    expect(got.get(HEAT)).toMatchObject({ name: "Heat", year: 1995, kind: "movie", fetchedAt: null });
    expect(got.get(SOPRANOS)).toMatchObject({ kind: "series", genres: ["Drama"] });
    // The graph half is still cached, with a null fetchedAt so the TMDB half
    // is filled the first time a token exists.
    expect((await store.getMany([HEAT])).get(HEAT)).toMatchObject({ name: "Heat", fetchedAt: null });
  });

  it("never runs more than five TMDB fetches at once", async () => {
    const store = new MemoryTitlesStore();
    const tmdb = fakeTmdb();
    const ids = Array.from({ length: 20 }, (_, i) => `tt10000${String(i).padStart(2, "0")}`);
    await getTitles(ids, { store, tmdb: tmdb.client, graph, now });
    expect(tmdb.peak()).toBeLessThanOrEqual(5);
  });

  it("a stale row is only refreshed when the caller can afford to wait", async () => {
    const store = new MemoryTitlesStore();
    await store.upsertMany([
      { imdbId: HEAT, tmdbId: 949, kind: "movie", name: "Heat", year: 1995, runtime: 170, seasons: null, genres: [], posterPath: null, providers: null, fetchedAt: "2026-01-01T00:00:00.000Z" },
    ]);

    const read = fakeTmdb();
    expect((await getTitles([HEAT], { store, tmdb: read.client, graph, now })).get(HEAT)?.posterPath).toBeNull();
    expect(read.calls).toEqual([]);

    const warm = fakeTmdb();
    const fresh = await getTitles([HEAT], { store, tmdb: warm.client, graph, now, refreshStale: true });
    expect(warm.calls.length).toBeGreaterThan(0);
    expect(fresh.get(HEAT)?.posterPath).toBe("/heat.jpg");
    expect(fresh.get(HEAT)?.fetchedAt).toBe("2026-09-11T10:00:00.000Z");
  });
});
