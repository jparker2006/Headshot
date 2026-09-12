import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  collapseTitle,
  dateOrder,
  matchNetflix,
  parseNetflix,
  toIsoDate,
  toNetflixInputs,
  worstNetflixMatches,
  type NetflixRow,
} from "@/lib/taste/netflix";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { fixtureGraph } from "../agent/helpers";

const CSV = fs.readFileSync(path.join(__dirname, "..", "fixtures", "imports", "netflix.csv"), "utf8");

/** A parsed row by the collapsed title. */
function row(rows: NetflixRow[], title: string): NetflixRow {
  const found = rows.find((r) => r.title === title);
  if (!found) throw new Error(`no parsed row titled ${title}`);
  return found;
}

describe("collapseTitle", () => {
  it("strips the season and episode off all three shapes Netflix writes", () => {
    expect(collapseTitle("Fleabag: Season 1: Episode 1")).toEqual({ title: "Fleabag", season: 1 });
    expect(collapseTitle('Breaking Bad: Season 2: "Grilled"')).toEqual({ title: "Breaking Bad", season: 2 });
    expect(collapseTitle("Stranger Things: Stranger Things 2: Chapter One")).toEqual({ title: "Stranger Things", season: 2 });
    expect(collapseTitle("The Queen's Gambit: Limited Series: Openings")).toEqual({ title: "The Queen's Gambit", season: 1 });
  });

  it("leaves a film whole, colons and all", () => {
    expect(collapseTitle("Apollo 13")).toEqual({ title: "Apollo 13", season: null });
    expect(collapseTitle("Léon: The Professional")).toEqual({ title: "Léon: The Professional", season: null });
    expect(collapseTitle("Star Wars: Episode V - The Empire Strikes Back")).toEqual({
      title: "Star Wars: Episode V - The Empire Strikes Back",
      season: null,
    });
  });
});

describe("dates", () => {
  it("reads a file as day-first only when some row proves it", () => {
    expect(dateOrder(["9/11/26", "12/24/25"])).toBe("mdy");
    expect(dateOrder(["9/11/26", "24/12/25"])).toBe("dmy");
    // Ambiguous stays month-first rather than flipping half the log.
    expect(dateOrder(["9/11/26"])).toBe("mdy");
  });

  it("expands two-digit years and honours the file's order", () => {
    expect(toIsoDate("9/11/26", "mdy")).toBe("2026-09-11");
    expect(toIsoDate("11/09/2026", "dmy")).toBe("2026-09-11");
    expect(toIsoDate("12/24/95", "mdy")).toBe("1995-12-24");
    expect(toIsoDate("2026-09-11", "mdy")).toBe("2026-09-11");
    expect(toIsoDate("not a date", "mdy")).toBeNull();
    expect(toIsoDate("13/40/26", "mdy")).toBeNull();
  });
});

describe("parseNetflix", () => {
  const rows = parseNetflix(CSV);

  it("collapses episodes to one row per show and counts them", () => {
    // 12 rows in, 8 titles out: two shows of three episodes, one of one, five films.
    expect(rows).toHaveLength(8);
    expect(row(rows, "Good Series")).toEqual({
      title: "Good Series",
      date: "2026-03-14",
      series: true,
      episodes: 3,
      season: 2,
    });
    // The "<Title> N" shape counts as season 3, so the max season is 3, not 1.
    expect(row(rows, "Late Night Show")).toMatchObject({ episodes: 3, season: 3, date: "2026-02-28" });
    expect(row(rows, "Mini Series")).toMatchObject({ episodes: 1, season: 1, series: true });
  });

  it("keeps films whole, with no season and no episode count", () => {
    expect(row(rows, "Apollo 13")).toEqual({ title: "Apollo 13", date: "2025-12-25", series: false, episodes: 0, season: null });
    // A quoted title with a comma in it survives the CSV intact.
    expect(row(rows, "Good Night, and Good Luck.").date).toBe("2025-11-28");
  });

  it("reads a day-first export the same way", () => {
    const parsed = parseNetflix('Title,Date\nFleabag: Season 1: Episode 1,11/09/2026\nApollo 13,24/12/2025\n');
    expect(row(parsed, "Fleabag").date).toBe("2026-09-11");
    expect(row(parsed, "Apollo 13").date).toBe("2025-12-24");
  });
});

describe("matchNetflix", () => {
  it("matches by name, prefers a series for an episode row, and skips the rest", async () => {
    const graph = await fixtureGraph();
    const { matched, unmatched } = matchNetflix(graph, parseNetflix(CSV));
    const byTitle = new Map(matched.map((m) => [m.row.title, m]));

    expect(matched).toHaveLength(6);
    expect(byTitle.get("Good Series")).toMatchObject({ imdbId: "tt0000009", confidence: 1 });
    expect(byTitle.get("Late Night Show")).toMatchObject({ imdbId: "tt0000003", confidence: 1 });
    expect(byTitle.get("Mini Series")).toMatchObject({ imdbId: "tt0000006", confidence: 1 });
    expect(byTitle.get("Apollo 13")).toMatchObject({ imdbId: "tt0000001", confidence: 1 });
    expect(byTitle.get("TV Movie")).toMatchObject({ imdbId: "tt0000011", confidence: 1 });

    // Nothing is guessed at: one title below the pipeline's vote floor and one
    // the graph has never heard of both come back unmatched.
    expect(unmatched.map((r) => r.title).sort()).toEqual(["Good Night, and Good Luck.", "Tiny Indie"]);
  });

  it("falls back to a substring match, still preferring a series for an episode row", async () => {
    const graph = await fixtureGraph();
    const asShow = matchNetflix(graph, [{ title: "Late Night", date: null, series: true, episodes: 4, season: 1 }]);
    expect(asShow.matched[0]).toMatchObject({ imdbId: "tt0000003", name: "Late Night Show", confidence: 0.5 });
  });

  it("writes `seen` rows with the season, the episode count and the latest date", async () => {
    const graph = await fixtureGraph();
    const { matched } = matchNetflix(graph, parseNetflix(CSV));
    const rows = new Map(toNetflixInputs(matched).map((r) => [r.titleImdbId, r]));

    // Netflix knows you pressed play and nothing else: never liked.
    expect([...rows.values()].every((r) => r.rating === "seen" && r.source === "netflix")).toBe(true);
    expect(rows.get("tt0000009")).toMatchObject({ season: 2, episodesWatched: 3, watchedAt: "2026-03-14T00:00:00.000Z" });
    expect(rows.get("tt0000003")).toMatchObject({ season: 3, episodesWatched: 3 });
    expect(rows.get("tt0000001")).toMatchObject({ season: null, episodesWatched: 0, watchedAt: "2025-12-25T00:00:00.000Z" });
  });

  it("orders the review least confident first", async () => {
    const graph = await fixtureGraph();
    const { matched } = matchNetflix(graph, [
      { title: "Late Night", date: null, series: true, episodes: 1, season: 1 },
      { title: "Apollo 13", date: null, series: false, episodes: 0, season: null },
    ]);
    expect(worstNetflixMatches(matched).map((m) => [m.row.title, m.confidence])).toEqual([
      ["Late Night", 0.5],
      ["Apollo 13", 1],
    ]);
  });
});

describe("re-upload", () => {
  it("replaces the Netflix rows and leaves every other source alone", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    const { matched } = matchNetflix(graph, parseNetflix(CSV));

    await store.upsertWatched("u1", [{ titleImdbId: "tt0000004", rating: "rated", score: 8, source: "letterboxd" }]);
    await store.replaceImport("u1", "netflix", toNetflixInputs(matched));
    expect(await store.listWatched("u1")).toHaveLength(7);

    await store.replaceImport("u1", "netflix", toNetflixInputs(matched.filter((m) => m.row.title === "Apollo 13")));
    const after = await store.listWatched("u1");
    expect(after.map((r) => r.titleImdbId)).toEqual(["tt0000001", "tt0000004"]);
    expect(after.find((r) => r.titleImdbId === "tt0000004")?.source).toBe("letterboxd");
  });
});
