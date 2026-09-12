import { beforeAll, describe, expect, it } from "vitest";
import { computeNumbers, MONTHS_WINDOW, roleFromDepartment, type NumbersData } from "@/lib/taste/numbers";
import type { TitleRow } from "@/lib/titles";
import type { WatchedRow } from "@/lib/taste/types";
import type { IndustryGraph } from "@/lib/graph";
import { fixtureGraph } from "../agent/helpers";

/** A fixed clock, so "the last 24 months" is the same window every run. */
const NOW = new Date("2026-09-11T12:00:00.000Z");

function watched(row: Partial<WatchedRow> & { titleImdbId: string; rating: WatchedRow["rating"] }): WatchedRow {
  return {
    score: row.rating === "rated" ? 8 : null,
    watchedAt: null,
    source: "log",
    season: null,
    episodesWatched: 0,
    updatedAt: "2026-09-11T12:00:00.000Z",
    ...row,
  };
}

function title(row: Partial<TitleRow> & { imdbId: string; name: string; kind: TitleRow["kind"] }): TitleRow {
  return {
    tmdbId: null,
    year: null,
    runtime: null,
    seasons: null,
    genres: [],
    posterPath: null,
    providers: null,
    fetchedAt: "2026-09-01T00:00:00.000Z",
    ...row,
  };
}

const ROWS: WatchedRow[] = [
  watched({ titleImdbId: "tt0000001", rating: "rated", score: 8, watchedAt: "2026-09-02T20:00:00.000Z" }),
  watched({ titleImdbId: "tt0000002", rating: "rated", score: 5, watchedAt: "2026-08-15T20:00:00.000Z", source: "letterboxd" }),
  // A show with a season pointer and no counter: every episode up to season 2.
  watched({ titleImdbId: "tt0000004", rating: "seen", watchedAt: "2026-09-05T20:00:00.000Z", season: 2, source: "netflix" }),
  // A show with both: the counter wins over the pointer.
  watched({ titleImdbId: "tt0000009", rating: "rated", score: 8, watchedAt: "2026-09-06T20:00:00.000Z", season: 1, episodesWatched: 5 }),
  // Want is a plan, not a watch.
  watched({ titleImdbId: "tt0000006", rating: "want" }),
  // Watched, but the user never said when.
  watched({ titleImdbId: "tt0000011", rating: "seen" }),
  // Older than the window, and a title the industry graph does not carry.
  watched({ titleImdbId: "tt0000005", rating: "rated", score: 8, watchedAt: "2020-01-01T20:00:00.000Z" }),
  // The swipe's removal verb: invisible to Numbers.
  watched({ titleImdbId: "tt0000007", rating: "unseen" }),
];

const TITLES = new Map<string, TitleRow>(
  [
    title({ imdbId: "tt0000001", name: "Apollo 13", kind: "movie", year: 1995, runtime: 140, genres: ["Adventure", "Drama", "History"], posterPath: "/a.jpg" }),
    title({ imdbId: "tt0000002", name: "Forrest Gump", kind: "movie", year: 1994, runtime: 142, genres: ["Drama", "Romance"] }),
    title({
      imdbId: "tt0000004",
      name: "Long Runner",
      kind: "series",
      year: 1990,
      runtime: 45,
      seasons: [{ season: 1, episodes: 10 }, { season: 2, episodes: 12 }, { season: 3, episodes: 8 }],
      genres: ["Drama"],
    }),
    title({
      imdbId: "tt0000009",
      name: "Good Series",
      kind: "series",
      year: 2018,
      runtime: 50,
      seasons: [{ season: 1, episodes: 10 }],
      genres: ["Drama", "Thriller"],
    }),
    title({ imdbId: "tt0000006", name: "Mini Series", kind: "series", year: 2010, runtime: 55, seasons: [{ season: 1, episodes: 6 }], genres: ["Drama", "War"] }),
    title({ imdbId: "tt0000011", name: "TV Movie", kind: "movie", year: 2008, runtime: 90, genres: ["Drama"] }),
    title({ imdbId: "tt0000005", name: "Tiny Indie", kind: "movie", year: 2019, runtime: 80, genres: ["Drama"] }),
  ].map((row) => [row.imdbId, row]),
);

let graph: IndustryGraph;
let data: NumbersData;

beforeAll(async () => {
  graph = await fixtureGraph();
  data = computeNumbers({ watched: ROWS, titles: TITLES, graph, now: NOW });
});

describe("computeNumbers: totals", () => {
  it("counts every row it keeps, split film vs show", () => {
    expect(data.totals).toEqual({
      titles: 7,
      films: 4,
      shows: 3,
      // 140 + 142 + (22 × 45) + (5 × 50) + 90 + 80 = 1692 minutes.
      hours: 28,
      liked: 3,
      meh: 1,
      seen: 2,
      want: 1,
    });
  });

  it("leaves the swipe's `unseen` rows out entirely", () => {
    expect(data.log.some((r) => r.imdbId === "tt0000007")).toBe(false);
    expect(data.totals.titles).toBe(ROWS.length - 1);
  });

  it("never guesses an hour it does not have", () => {
    const noRuntime = computeNumbers({
      watched: [watched({ titleImdbId: "tt0000001", rating: "rated", score: 8, watchedAt: "2026-09-02T20:00:00.000Z" })],
      titles: new Map([["tt0000001", title({ imdbId: "tt0000001", name: "Apollo 13", kind: "movie" })]]),
      graph,
      now: NOW,
    });
    expect(noRuntime.totals.hours).toBe(0);
  });

  it("gives a show with neither a counter nor a pointer no hours", () => {
    const idle = computeNumbers({
      watched: [watched({ titleImdbId: "tt0000004", rating: "seen", watchedAt: "2026-09-05T20:00:00.000Z" })],
      titles: TITLES,
      graph,
      now: NOW,
    });
    expect(idle.totals.hours).toBe(0);
    expect(idle.totals.shows).toBe(1);
  });
});

describe("computeNumbers: months", () => {
  it("reports 24 months ending at now, oldest first, empty ones included", () => {
    expect(data.months).toHaveLength(MONTHS_WINDOW);
    expect(data.months[0].month).toBe("2024-10");
    expect(data.months.at(-1)!.month).toBe("2026-09");
    expect(data.months.filter((m) => m.films + m.shows === 0)).toHaveLength(MONTHS_WINDOW - 2);
  });

  it("splits the month into films and shows with hours to one decimal", () => {
    expect(data.months.at(-1)).toEqual({ month: "2026-09", films: 1, shows: 2, hours: 23 });
    expect(data.months.at(-2)).toEqual({ month: "2026-08", films: 1, shows: 0, hours: 2.4 });
  });

  it("keeps a row older than the window out of the chart but in the totals", () => {
    expect(data.months.some((m) => m.month === "2020-01")).toBe(false);
    expect(data.log.some((r) => r.imdbId === "tt0000005")).toBe(true);
  });

  it("counts undated watches separately and never in a month", () => {
    // The `want` row has no date either, and is not a watch.
    expect(data.undated).toBe(1);
    expect(data.months.reduce((n, m) => n + m.films + m.shows, 0)).toBe(4);
  });
});

describe("computeNumbers: people", () => {
  it("ranks by credits across what you watched, most first", () => {
    expect(data.people[0]).toMatchObject({ imdbId: "nm0000003", name: "Bill Paxton", count: 3, role: "actor" });
    expect(data.people.map((p) => p.count)).toEqual([...data.people.map((p) => p.count)].sort((a, b) => b - a));
    expect(data.people.length).toBeLessThanOrEqual(12);
  });

  it("calls a credit with a character an actor and says nothing it cannot prove", () => {
    const roles = Object.fromEntries(data.people.map((p) => [p.imdbId, p.role]));
    expect(roles["nm0000002"]).toBe("actor");
    // Wes Director is only ever credited without a character in the fixture.
    expect(roles["nm0000006"]).toBe("other");
  });

  it("caps the grid at twelve", () => {
    expect(computeNumbers({ watched: ROWS, titles: TITLES, graph, now: NOW }).people.length).toBe(data.people.length);
    expect(data.people.length).toBe(10);
  });

  it("ignores people you only want to watch", () => {
    // Mini Series is a `want` row; nobody on it gets a credit from it.
    const onlyWant = computeNumbers({
      watched: [watched({ titleImdbId: "tt0000006", rating: "want" })],
      titles: TITLES,
      graph,
      now: NOW,
    });
    expect(onlyWant.people).toEqual([]);
    expect(onlyWant.decades).toEqual([]);
    expect(onlyWant.genres).toEqual([]);
    expect(onlyWant.totals.want).toBe(1);
  });
});

describe("computeNumbers: decades, runtime, genres", () => {
  it("counts decades of what you watched, biggest first", () => {
    expect(data.decades).toEqual([
      { decade: "1990s", count: 3 },
      { decade: "2010s", count: 2 },
      { decade: "2000s", count: 1 },
    ]);
  });

  it("averages film runtime only", () => {
    // (140 + 142 + 90 + 80) / 4 — the shows' episode runtimes are not films.
    expect(data.runtimeFinished).toBe(113);
  });

  it("splits every genre into liked, meh and seen", () => {
    expect(data.genres[0]).toEqual({ genre: "Drama", liked: 3, meh: 1, seen: 2 });
    expect(data.genres.find((g) => g.genre === "Romance")).toEqual({ genre: "Romance", liked: 0, meh: 1, seen: 0 });
    // War only ever appears on the wanted title.
    expect(data.genres.find((g) => g.genre === "War")).toBeUndefined();
  });
});

describe("computeNumbers: the log", () => {
  it("is newest first with undated rows at the bottom", () => {
    expect(data.log.map((r) => r.imdbId)).toEqual([
      "tt0000009",
      "tt0000004",
      "tt0000001",
      "tt0000002",
      "tt0000005",
      "tt0000006",
      "tt0000011",
    ]);
  });

  it("carries what the table draws", () => {
    expect(data.log[2]).toEqual({
      imdbId: "tt0000001",
      name: "Apollo 13",
      year: 1995,
      kind: "movie",
      state: "rated",
      score: 8,
      watchedAt: "2026-09-02T20:00:00.000Z",
      addedAt: "2026-09-11T12:00:00.000Z",
      source: "log",
      season: null,
      runtime: 140,
      genres: ["Adventure", "Drama", "History"],
      posterPath: "/a.jpg",
      note: null,
    });
  });

  it("carries the line the user wrote, when the caller hands one over", () => {
    const notes = new Map([["tt0000001", "the diner scene, two pros sizing each other up"]]);
    const withNotes = computeNumbers({ watched: ROWS, titles: TITLES, graph, now: NOW, notes });
    expect(withNotes.log.find((r) => r.imdbId === "tt0000001")!.note).toBe("the diner scene, two pros sizing each other up");
    expect(withNotes.log.find((r) => r.imdbId === "tt0000002")!.note).toBeNull();
  });

  it("falls back to the graph when the titles cache has never seen the row", () => {
    const cold = computeNumbers({ watched: ROWS, titles: new Map(), graph, now: NOW });
    const apollo = cold.log.find((r) => r.imdbId === "tt0000001")!;
    expect(apollo).toMatchObject({ name: "Apollo 13", year: 1995, kind: "movie", runtime: null });
    expect(apollo.genres).toEqual(["Adventure", "Drama", "History"]);
    // Nothing is known about a title neither half carries, and it still lists.
    expect(cold.log.find((r) => r.imdbId === "tt0000005")).toMatchObject({ name: "tt0000005", year: null, kind: "movie" });
    expect(cold.totals.hours).toBe(0);
  });
});

describe("roleFromDepartment", () => {
  it("maps TMDB's department onto the three roles it knows", () => {
    expect(roleFromDepartment("Acting")).toBe("actor");
    expect(roleFromDepartment("Directing")).toBe("director");
    expect(roleFromDepartment("Writing")).toBe("writer");
    expect(roleFromDepartment("Sound")).toBeNull();
    expect(roleFromDepartment(undefined)).toBeNull();
  });
});
