import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { matchImdb, parseImdb, scoreForImdb, toImdbInputs } from "@/lib/taste/imdb";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { fixtureGraph } from "../agent/helpers";

const CSV = fs.readFileSync(path.join(__dirname, "..", "fixtures", "imports", "imdb.csv"), "utf8");

describe("parseImdb", () => {
  it("reads the export keyed by Const", () => {
    const rows = parseImdb(CSV);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual({
      imdbId: "tt0000001",
      name: "Apollo 13",
      year: 1995,
      rating: 9,
      ratedAt: "2026-02-01",
      titleType: "Movie",
    });
    // A quoted title with a comma in it survives the CSV intact.
    expect(rows.at(-1)).toMatchObject({ imdbId: "tt9999999", name: "Nowhere, Nebraska" });
  });

  it("drops rows that are not ratings and keeps the last rating for an id", () => {
    const rows = parseImdb(
      "Const,Your Rating,Date Rated,Title,Year\n" +
        "tt0000001,,2026-02-01,Apollo 13,1995\n" +
        "not-an-id,8,2026-02-01,Something,1999\n" +
        "tt0000002,3,2026-02-01,Forrest Gump,1994\n" +
        "tt0000002,8,2026-03-01,Forrest Gump,1994\n",
    );
    expect(rows).toEqual([
      { imdbId: "tt0000002", name: "Forrest Gump", year: 1994, rating: 8, ratedAt: "2026-03-01", titleType: null },
    ]);
  });

  it("accepts the older US short date as well as an ISO one", () => {
    const rows = parseImdb("Const,Your Rating,Date Rated,Title,Year\ntt0000001,9,2/1/2026,Apollo 13,1995\n");
    expect(rows[0].ratedAt).toBe("2026-02-01");
  });
});

describe("scoreForImdb", () => {
  it("keeps the number the user chose", () => {
    expect(scoreForImdb(10)).toBe(10);
    expect(scoreForImdb(7)).toBe(7);
    expect(scoreForImdb(6)).toBe(6);
    expect(scoreForImdb(1)).toBe(1);
    // Out of range is clamped rather than written as junk.
    expect(scoreForImdb(0)).toBe(1);
    expect(scoreForImdb(11)).toBe(10);
  });
});

describe("matchImdb", () => {
  it("resolves ids against the graph and reports the misses as skipped", async () => {
    const graph = await fixtureGraph();
    const { matched, skipped } = matchImdb(graph, parseImdb(CSV));

    expect(matched.map((m) => m.imdbId)).toEqual([
      "tt0000001",
      "tt0000002",
      "tt0000003",
      "tt0000004",
      "tt0000009",
      "tt0000006",
    ]);
    // The graph's own name for the title, not the export's.
    expect(matched[0]).toMatchObject({ name: "Apollo 13", year: 1995 });
    expect(skipped.map((r) => r.imdbId)).toEqual(["tt8888888", "tt9999999"]);
  });

  it("writes the rows with the user's own number and the rated date", async () => {
    const graph = await fixtureGraph();
    const { matched } = matchImdb(graph, parseImdb(CSV));
    const rows = new Map(toImdbInputs(matched).map((r) => [r.titleImdbId, r]));

    expect([...rows.values()].every((r) => r.source === "imdb")).toBe(true);
    expect(rows.get("tt0000001")).toMatchObject({ rating: "rated", score: 9, watchedAt: "2026-02-01T00:00:00.000Z" });
    expect(rows.get("tt0000003")?.score).toBe(7);
    expect(rows.get("tt0000009")?.score).toBe(10);
    expect(rows.get("tt0000006")?.score).toBe(8);
    expect(rows.get("tt0000002")?.score).toBe(6);
    expect(rows.get("tt0000004")?.score).toBe(4);
  });
});

describe("re-upload", () => {
  it("replaces the IMDb rows and leaves every other source alone", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    const { matched } = matchImdb(graph, parseImdb(CSV));

    await store.upsertWatched("u1", [{ titleImdbId: "tt0000011", rating: "seen", source: "swipe" }]);
    await store.replaceImport("u1", "imdb", toImdbInputs(matched));
    expect(await store.listWatched("u1")).toHaveLength(7);

    await store.replaceImport("u1", "imdb", toImdbInputs(matched.filter((m) => m.imdbId === "tt0000002")));
    const after = await store.listWatched("u1");
    expect(after.map((r) => r.titleImdbId)).toEqual(["tt0000002", "tt0000011"]);
    expect(after.find((r) => r.titleImdbId === "tt0000011")?.source).toBe("swipe");
  });
});
