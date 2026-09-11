import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  bucketFor,
  matchToGraph,
  parseCsv,
  parseLetterboxd,
  toWatchedInputs,
  worstMatches,
  type LetterboxdRow,
} from "@/lib/taste/letterboxd";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { fixtureGraph } from "../agent/helpers";

const DIR = path.join(__dirname, "..", "fixtures", "letterboxd");
const read = (name: string) => fs.readFileSync(path.join(DIR, name), "utf8");
const files = () => ({ ratings: read("ratings.csv"), watched: read("watched.csv"), watchlist: read("watchlist.csv") });

/** A row by the name the export used. */
function row(rows: LetterboxdRow[], name: string): LetterboxdRow {
  const found = rows.find((r) => r.name === name);
  if (!found) throw new Error(`no parsed row named ${name}`);
  return found;
}

describe("CSV reader", () => {
  it("handles quotes, commas inside quotes, doubled quotes, and CRLF", () => {
    const text = 'Date,Name,Year\r\n2024-05-09,"Good Night, and Good Luck.",2005\r\n2024-01-01,"She said ""hi""",1999\r\n';
    expect(parseCsv(text)).toEqual([
      ["Date", "Name", "Year"],
      ["2024-05-09", "Good Night, and Good Luck.", "2005"],
      ["2024-01-01", 'She said "hi"', "1999"],
    ]);
  });

  it("does not emit a trailing empty row for a file ending in a newline", () => {
    expect(parseCsv("a,b\n1,2\n")).toHaveLength(2);
  });
});

describe("parseLetterboxd", () => {
  it("reads the three exports into one row per title", () => {
    const rows = parseLetterboxd(files());
    expect(rows).toHaveLength(9);
    expect(row(rows, "Apollo 13")).toEqual({
      name: "Apollo 13",
      year: 1995,
      rating: 4.5,
      watchedAt: "2024-01-05",
      list: "watched",
    });
    // A title with a comma survives the quoting intact.
    expect(row(rows, "Good Night, and Good Luck.").rating).toBe(4.5);
    // Watched with no rating stays unrated rather than being guessed at.
    expect(row(rows, "Long Runner")).toMatchObject({ rating: null, list: "watched", watchedAt: "2024-06-20" });
    expect(row(rows, "TV Movie")).toMatchObject({ rating: null, list: "watchlist", watchedAt: null });
  });

  it("keeps the rating when a title is in both ratings.csv and watched.csv", () => {
    const rows = parseLetterboxd(files());
    expect(rows.filter((r) => r.name === "Forrest Gump")).toHaveLength(1);
    expect(row(rows, "Forrest Gump").rating).toBe(3);
  });

  it("takes the watch date from diary.csv's Watched Date column", () => {
    const rows = parseLetterboxd({
      diary: "Date,Name,Year,Letterboxd URI,Rating,Watched Date\n2024-08-02,Apollo 13,1995,https://boxd.it/a1,4.5,2024-07-30\n",
    });
    expect(rows[0]).toMatchObject({ name: "Apollo 13", rating: 4.5, watchedAt: "2024-07-30" });
  });

  it("counts a title on both the watchlist and the watched list as watched", () => {
    const rows = parseLetterboxd({
      watchlist: "Date,Name,Year,Letterboxd URI\n2024-01-01,Apollo 13,1995,https://boxd.it/a1\n",
      watched: "Date,Name,Year,Letterboxd URI\n2024-02-01,Apollo 13,1995,https://boxd.it/a1\n",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].list).toBe("watched");
  });
});

describe("bucket mapping", () => {
  it("uses four buckets and nothing else", () => {
    const base = { name: "x", year: 2000, watchedAt: null } as const;
    expect(bucketFor({ ...base, rating: 5, list: "watched" })).toBe("liked");
    expect(bucketFor({ ...base, rating: 3.5, list: "watched" })).toBe("liked");
    expect(bucketFor({ ...base, rating: 3, list: "watched" })).toBe("meh");
    expect(bucketFor({ ...base, rating: 0.5, list: "watched" })).toBe("meh");
    // Watched but unrated counts as seen, not liked.
    expect(bucketFor({ ...base, rating: null, list: "watched" })).toBe("meh");
    expect(bucketFor({ ...base, rating: null, list: "watchlist" })).toBe("want");
  });
});

describe("matchToGraph", () => {
  it("scores the confidence tiers and leaves the rest unmatched", async () => {
    const graph = await fixtureGraph();
    const { matched, unmatched } = matchToGraph(graph, parseLetterboxd(files()));

    const byName = new Map(matched.map((m) => [m.row.name, m]));
    expect(matched).toHaveLength(7);

    // 1.0 — same name, same year.
    expect(byName.get("Apollo 13")).toMatchObject({ imdbId: "tt0000001", confidence: 1 });
    expect(byName.get("Good Series")).toMatchObject({ imdbId: "tt0000009", confidence: 1 });
    expect(byName.get("TV Movie")).toMatchObject({ imdbId: "tt0000011", confidence: 1 });
    // 0.7 — same name, the export disagrees about the year.
    expect(byName.get("Mini Series")).toMatchObject({ imdbId: "tt0000006", year: 2010, confidence: 0.7 });
    // 0.5 — the graph's name contains the export's, and the year matches.
    expect(byName.get("Late Night")).toMatchObject({ imdbId: "tt0000003", name: "Late Night Show", confidence: 0.5 });

    // Nothing is guessed at: a title the graph has never heard of, and one
    // below the pipeline's vote floor, both come back unmatched.
    expect(unmatched.map((r) => r.name).sort()).toEqual(["Good Night, and Good Luck.", "Tiny Indie"]);
  });

  it("turns matches into store rows with the right buckets and dates", async () => {
    const graph = await fixtureGraph();
    const { matched } = matchToGraph(graph, parseLetterboxd(files()));
    const rows = new Map(toWatchedInputs(matched).map((r) => [r.titleImdbId, r]));

    expect(rows.get("tt0000001")).toMatchObject({ rating: "liked", source: "letterboxd", watchedAt: "2024-01-05T00:00:00.000Z" });
    expect(rows.get("tt0000002")?.rating).toBe("meh");
    expect(rows.get("tt0000009")?.rating).toBe("liked");
    expect(rows.get("tt0000006")?.rating).toBe("liked");
    expect(rows.get("tt0000003")?.rating).toBe("meh");
    expect(rows.get("tt0000004")).toMatchObject({ rating: "meh", watchedAt: "2024-06-20T00:00:00.000Z" });
    expect(rows.get("tt0000011")).toMatchObject({ rating: "want", watchedAt: null });
  });
});

describe("worstMatches", () => {
  it("orders least confident first, then by name, and honours n", async () => {
    const graph = await fixtureGraph();
    const { matched } = matchToGraph(graph, parseLetterboxd(files()));

    expect(worstMatches(matched, 3).map((m) => [m.row.name, m.confidence])).toEqual([
      ["Late Night", 0.5],
      ["Mini Series", 0.7],
      ["Apollo 13", 1],
    ]);
    expect(worstMatches(matched)).toHaveLength(7);
    expect(worstMatches(matched, 10).map((m) => m.confidence)).toEqual([0.5, 0.7, 1, 1, 1, 1, 1]);
  });
});

describe("re-upload", () => {
  it("replaces the previous import and leaves swipes and chat rows alone", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    const { matched } = matchToGraph(graph, parseLetterboxd(files()));

    await store.upsertWatched("u1", [{ titleImdbId: "tt0000005", rating: "liked", source: "swipe" }]);
    await store.replaceImport("u1", "letterboxd", toWatchedInputs(matched));
    expect(await store.listWatched("u1")).toHaveLength(8);

    // A second, smaller export: the old letterboxd rows go, the swipe stays.
    const smaller = matchToGraph(graph, parseLetterboxd({ ratings: read("ratings.csv") })).matched.filter(
      (m) => m.row.name === "Apollo 13",
    );
    await store.replaceImport("u1", "letterboxd", toWatchedInputs(smaller));

    const after = await store.listWatched("u1");
    expect(after.map((r) => r.titleImdbId)).toEqual(["tt0000001", "tt0000005"]);
    expect(after.find((r) => r.titleImdbId === "tt0000005")?.source).toBe("swipe");
    expect(after.find((r) => r.titleImdbId === "tt0000001")?.source).toBe("letterboxd");
  });
});
