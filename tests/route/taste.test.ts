import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createTasteHandlers } from "@/lib/taste/routes";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { MemoryTitlesStore } from "@/lib/titles/memory";
import { PROVIDERS } from "@/lib/taste/providers";
import { fixtureGraph } from "../agent/helpers";

const DIR = path.join(__dirname, "..", "fixtures", "letterboxd");
const read = (name: string) => fs.readFileSync(path.join(DIR, name), "utf8");
const IMPORTS = path.join(__dirname, "..", "fixtures", "imports");
const readImport = (name: string) => fs.readFileSync(path.join(IMPORTS, name), "utf8");

let store: MemoryTasteStore;
let titles: MemoryTitlesStore;
/** Flipped per test to stand in for the session. */
let signedInAs: string | null;
/** Background warms the route scheduled; tests await them explicitly. */
let scheduled: Promise<void>[];
/** Stands in for TMDB's headshot lookup in the Numbers route. */
let faces: Record<string, { url: string | null; knownAs?: string }>;

const handlers = createTasteHandlers({
  userId: async () => signedInAs,
  store: async () => store,
  graph: fixtureGraph,
  titles: async () => titles,
  // No TMDB in tests: a warm is a no-op beyond the graph half.
  tmdb: () => null,
  faces: async (ids) => Object.fromEntries(ids.filter((id) => id in faces).map((id) => [id, faces[id]])),
  schedule: (work) => scheduled.push(work()),
});

beforeEach(() => {
  store = new MemoryTasteStore();
  titles = new MemoryTitlesStore();
  signedInAs = "user-1";
  scheduled = [];
  faces = {};
});

const json = (body: unknown, method = "POST") =>
  new Request("https://headshot.test/api/taste", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const get = () => new Request("https://headshot.test/api/taste");

describe("taste routes: sign-in", () => {
  it("refuses every taste route when signed out", async () => {
    signedInAs = null;
    const calls: Promise<Response>[] = [
      handlers.listWatched(get()),
      handlers.getServices(get()),
      handlers.putServices(json({ providerIds: [8] }, "PUT")),
      handlers.importCsv(json({ ratings: read("ratings.csv") })),
      handlers.importCsv(json({ source: "netflix", file: readImport("netflix.csv") })),
      handlers.importCsv(json({ source: "imdb", file: readImport("imdb.csv") })),
      handlers.confirmImport(json({ fixes: [] })),
      handlers.log(json({ query: "Apollo" })),
      handlers.log(json({ imdbId: "tt0000001", score: 8 })),
      handlers.numbers(get()),
      handlers.startLetterboxdCrawl(json({ username: "jake" })),
      handlers.letterboxdCrawlStatus(get()),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "sign_in_required" });
    }
    // Nothing was written on the way to the refusal.
    expect(await store.listWatched("user-1")).toEqual([]);
  });
});

describe("taste routes: services", () => {
  it("round-trips the checklist and offers the provider list", async () => {
    const empty = await (await handlers.getServices(get())).json();
    expect(empty.providerIds).toEqual([]);
    expect(empty.region).toBe("US");
    expect(empty.providers).toHaveLength(PROVIDERS.length);
    expect(empty.providers[0]).toMatchObject({ id: 8, name: "Netflix" });

    const put = await handlers.putServices(json({ providerIds: [1899, 8] }, "PUT"));
    expect(put.status).toBe(200);
    // Stored in checklist order, whatever order the taps arrived in.
    expect((await put.json()).providerIds).toEqual([8, 1899]);

    expect((await (await handlers.getServices(get())).json()).providerIds).toEqual([8, 1899]);
  });

  it("drops ids that are not on the checklist and rejects a bad body", async () => {
    await handlers.putServices(json({ providerIds: [8, 99999] }, "PUT"));
    expect((await store.getServices("user-1"))?.providerIds).toEqual([8]);

    const bad = await handlers.putServices(json({}, "PUT"));
    expect(bad.status).toBe(400);
  });
});

describe("taste routes: import", () => {
  const files = { ratings: read("ratings.csv"), watched: read("watched.csv"), watchlist: read("watchlist.csv") };

  it("imports the fixture export and reports counts, unmatched rows, and a review list", async () => {
    const res = await handlers.importCsv(json(files));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.parsed).toBe(9);
    expect(body.imported).toBe(7);
    expect(body.unmatched.map((r: { name: string }) => r.name).sort()).toEqual([
      "Good Night, and Good Luck.",
      "Tiny Indie",
    ]);
    // Least confident first: the human only has to look at the top of this.
    expect(body.review.slice(0, 2)).toMatchObject([
      { name: "Late Night", matchedName: "Late Night Show", imdbId: "tt0000003", confidence: 0.5 },
      { name: "Mini Series", matchedYear: 2010, imdbId: "tt0000006", confidence: 0.7 },
    ]);

    const stored = await store.listWatched("user-1");
    expect(stored).toHaveLength(7);
    expect(stored.every((r) => r.source === "letterboxd")).toBe(true);
    expect(stored.find((r) => r.titleImdbId === "tt0000011")?.rating).toBe("want");
  });

  it("accepts a multipart upload of the same files", async () => {
    const form = new FormData();
    form.set("ratings", new File([files.ratings], "ratings.csv", { type: "text/csv" }));
    form.set("watchlist", new File([files.watchlist], "watchlist.csv", { type: "text/csv" }));
    const res = await handlers.importCsv(
      new Request("https://headshot.test/api/taste/import", { method: "POST", body: form }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).imported).toBe(6);
  });

  it("re-upload replaces the previous import", async () => {
    await handlers.importCsv(json(files));
    await handlers.importCsv(json({ ratings: "Date,Name,Year,Letterboxd URI,Rating\n2024-01-05,Apollo 13,1995,u,4.5\n" }));
    expect((await store.listWatched("user-1")).map((r) => r.titleImdbId)).toEqual(["tt0000001"]);
  });

  it("refuses an upload with no CSVs in it", async () => {
    const res = await handlers.importCsv(json({}));
    expect(res.status).toBe(400);
  });
});

describe("taste routes: import — Netflix", () => {
  const body = () => json({ source: "netflix", file: readImport("netflix.csv") });

  it("collapses episodes, writes `seen` rows, and reports what it skipped", async () => {
    const res = await handlers.importCsv(body());
    expect(res.status).toBe(200);
    const out = await res.json();

    expect(out).toMatchObject({ source: "netflix", parsed: 8, imported: 6, skipped: 2 });
    expect(out.unmatched.map((r: { name: string }) => r.name).sort()).toEqual(["Good Night, and Good Luck.", "Tiny Indie"]);

    const stored = await store.listWatched("user-1");
    expect(stored).toHaveLength(6);
    // Netflix never says you liked it.
    expect(stored.every((r) => r.rating === "seen" && r.source === "netflix")).toBe(true);
    expect(stored.find((r) => r.titleImdbId === "tt0000009")).toMatchObject({ season: 2, episodesWatched: 3 });
  });

  it("replaces only the Netflix rows on re-upload", async () => {
    await handlers.importCsv(json({ ratings: read("ratings.csv"), watched: read("watched.csv"), watchlist: read("watchlist.csv") }));
    await handlers.importCsv(body());
    await handlers.importCsv(json({ source: "netflix", file: "Title,Date\nApollo 13,12/25/25\n" }));

    const rows = await store.listWatched("user-1");
    expect(rows.filter((r) => r.source === "netflix").map((r) => r.titleImdbId)).toEqual(["tt0000001"]);
    // The one Letterboxd title Netflix never saw is untouched by either upload.
    expect(rows.filter((r) => r.source === "letterboxd").map((r) => r.titleImdbId)).toEqual(["tt0000004"]);
  });

  it("accepts a multipart upload and records one episode", async () => {
    const form = new FormData();
    form.set("source", "netflix");
    form.set("file", new File([readImport("netflix.csv")], "NetflixViewingHistory.csv", { type: "text/csv" }));
    const res = await handlers.importCsv(new Request("https://headshot.test/api/taste/import", { method: "POST", body: form }));
    expect((await res.json()).imported).toBe(6);

    const episodes = await store.listEpisodes("user-1");
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ kind: "log", titleImdbId: null, text: "imported 6 titles from Netflix" });
  });

  it("warms the titles cache for what it matched", async () => {
    await handlers.importCsv(body());
    await Promise.all(scheduled);
    expect((await titles.getMany(["tt0000009"])).get("tt0000009")).toMatchObject({ name: "Good Series" });
  });

  it("re-points a wrong Netflix match from the review screen", async () => {
    await handlers.importCsv(body());
    const res = await handlers.confirmImport(
      json({ source: "netflix", fixes: [{ name: "TV Movie", year: null, from: "tt0000011", imdbId: null }] }),
    );
    expect(await res.json()).toMatchObject({ corrected: 0, dropped: 1 });
    expect((await store.listWatched("user-1")).some((r) => r.titleImdbId === "tt0000011")).toBe(false);
  });
});

describe("taste routes: import — IMDb", () => {
  const body = () => json({ source: "imdb", file: readImport("imdb.csv") });

  it("keeps the user's own 1-10 numbers, and reports the ids the graph lacks", async () => {
    const res = await handlers.importCsv(body());
    expect(res.status).toBe(200);
    const out = await res.json();

    expect(out).toMatchObject({ source: "imdb", parsed: 8, imported: 6, skipped: 2 });
    // Matched by id, so there is nothing for a human to check.
    expect(out.review).toEqual([]);
    expect(out.unmatched.map((r: { imdbId: string }) => r.imdbId)).toEqual(["tt8888888", "tt9999999"]);

    const rows = new Map((await store.listWatched("user-1")).map((r) => [r.titleImdbId, r]));
    expect([...rows.values()].every((r) => r.source === "imdb")).toBe(true);
    expect(rows.get("tt0000001")?.score).toBe(9);
    expect(rows.get("tt0000003")?.score).toBe(7);
    expect(rows.get("tt0000002")?.score).toBe(6);
    expect(rows.get("tt0000004")?.score).toBe(4);
    expect(rows.get("tt0000001")?.watchedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("replaces only the IMDb rows on re-upload, and logs one episode each time", async () => {
    await handlers.importCsv(json({ source: "netflix", file: readImport("netflix.csv") }));
    await handlers.importCsv(body());
    await handlers.importCsv(
      json({ source: "imdb", file: "Const,Your Rating,Date Rated,Title,Year\ntt0000002,9,2026-04-01,Forrest Gump,1994\n" }),
    );

    const rows = await store.listWatched("user-1");
    expect(rows.filter((r) => r.source === "imdb").map((r) => r.titleImdbId)).toEqual(["tt0000002"]);
    expect(rows.filter((r) => r.source === "netflix").length).toBeGreaterThan(0);

    expect((await store.listEpisodes("user-1")).map((e) => e.text)).toEqual([
      "imported 1 titles from IMDb",
      "imported 6 titles from IMDb",
      "imported 6 titles from Netflix",
    ]);
  });

  it("refuses an upload with no CSV in it", async () => {
    expect((await handlers.importCsv(json({ source: "imdb" }))).status).toBe(400);
  });
});

describe("taste routes: import confirm", () => {
  const files = { ratings: read("ratings.csv"), watched: read("watched.csv"), watchlist: read("watchlist.csv") };

  it("re-points a wrong match and keeps the bucket it already had", async () => {
    await handlers.importCsv(json(files));
    // "Late Night" matched Late Night Show at 0.5; the user says it is Long Runner.
    const res = await handlers.confirmImport(json({ fixes: [{ name: "Late Night", year: 2001, imdbId: "tt0000004" }] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ corrected: 1, dropped: 0 });

    const rows = await store.listWatched("user-1");
    expect(rows.find((r) => r.titleImdbId === "tt0000003")).toBeUndefined();
    // tt0000004 was already a 5 from the unrated Long Runner row and stays so.
    expect(rows.find((r) => r.titleImdbId === "tt0000004")?.score).toBe(5);
  });

  it("drops a row when the user says none of the matches are it", async () => {
    await handlers.importCsv(json(files));
    const res = await handlers.confirmImport(json({ fixes: [{ name: "Mini Series", year: 2011, imdbId: null }] }));
    expect(await res.json()).toMatchObject({ corrected: 0, dropped: 1 });
    expect((await store.listWatched("user-1")).some((r) => r.titleImdbId === "tt0000006")).toBe(false);
  });

  it("files a previously unmatched row under the state and score the client names", async () => {
    await handlers.importCsv(json(files));
    const res = await handlers.confirmImport(
      json({ fixes: [{ name: "Good Night, and Good Luck.", year: 2005, imdbId: "tt0000011", rating: "rated", score: 8 }] }),
    );
    expect(await res.json()).toMatchObject({ corrected: 1 });
    expect((await store.listWatched("user-1")).find((r) => r.titleImdbId === "tt0000011")?.score).toBe(8);
  });

  it("rejects a body without fixes", async () => {
    expect((await handlers.confirmImport(json({}))).status).toBe(400);
  });
});

describe("taste routes: watched", () => {
  it("lists what the store holds for the signed-in user", async () => {
    await store.upsertWatched("user-1", [{ titleImdbId: "tt0000001", rating: "rated", score: 8, source: "swipe" }]);
    await store.upsertWatched("someone-else", [{ titleImdbId: "tt0000002", rating: "rated", score: 5, source: "swipe" }]);

    const body = await (await handlers.listWatched(get())).json();
    expect(body.watched).toMatchObject([{ titleImdbId: "tt0000001", rating: "rated", score: 8, source: "swipe" }]);
  });
});

describe("taste routes: log", () => {
  it("resolves what the user is typing to candidates, films and shows alike", async () => {
    const res = await handlers.log(json({ query: "Apollo" }));
    expect(res.status).toBe(200);
    expect((await res.json()).candidates).toEqual([
      { imdbId: "tt0000001", name: "Apollo 13", year: 1995, kind: "movie", seasons: null },
    ]);

    const show = await (await handlers.log(json({ query: "Late Night Show" }))).json();
    expect(show.candidates[0]).toMatchObject({ imdbId: "tt0000003", kind: "series", seasons: null });

    // At most six, and nothing at all until there is something to match on.
    const many = await (await handlers.log(json({ query: "e" }))).json();
    expect(many.candidates).toEqual([]);
    const some = await (await handlers.log(json({ query: "se" }))).json();
    expect(some.candidates.length).toBeLessThanOrEqual(6);
  });

  it("a candidate carries its seasons once the titles cache has them", async () => {
    await titles.upsertMany([
      {
        imdbId: "tt0000003",
        tmdbId: 3,
        kind: "series",
        name: "Late Night Show",
        year: 2001,
        runtime: 60,
        seasons: [{ season: 1, episodes: 10 }, { season: 2, episodes: 12 }],
        genres: ["Comedy"],
        posterPath: null,
        providers: null,
        fetchedAt: "2026-09-11T10:00:00.000Z",
      },
    ]);
    const body = await (await handlers.log(json({ query: "Late Night Show" }))).json();
    expect(body.candidates[0].seasons).toEqual([{ season: 1, episodes: 10 }, { season: 2, episodes: 12 }]);
  });

  it("writes the watched row and one episode with the line verbatim", async () => {
    const res = await handlers.log(json({ imdbId: "tt0000001", score: 8, text: 'the "reentry" bit still gets me' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.row).toMatchObject({ titleImdbId: "tt0000001", rating: "rated", score: 8, source: "log" });
    expect(typeof body.row.watchedAt).toBe("string");

    expect(await store.listWatched("user-1")).toMatchObject([{ titleImdbId: "tt0000001", rating: "rated", score: 8, source: "log" }]);
    const episodes = await store.listEpisodes("user-1");
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ kind: "log", titleImdbId: "tt0000001" });
    // The user's own words, unparaphrased.
    expect(episodes[0].text).toBe('rated Apollo 13 (1995) 8/10: "the \"reentry\" bit still gets me"');

    // The titles cache is warmed in the background, never on the way out.
    await Promise.all(scheduled);
    expect((await titles.getMany(["tt0000001"])).get("tt0000001")).toMatchObject({ name: "Apollo 13", year: 1995 });
  });

  it("logs a season of a show, and the neutral `seen` state", async () => {
    await handlers.log(json({ imdbId: "tt0000003", state: "seen", season: 2 }));
    expect(await store.listWatched("user-1")).toMatchObject([{ titleImdbId: "tt0000003", rating: "seen", season: 2, source: "log" }]);
    expect((await store.listEpisodes("user-1"))[0].text).toBe("seen Late Night Show (2001)");
  });

  it("refuses a score off the scale, a junk state, and a body that says nothing", async () => {
    expect((await handlers.log(json({ imdbId: "tt0000001", score: 0 }))).status).toBe(400);
    expect((await handlers.log(json({ imdbId: "tt0000001", score: 11 }))).status).toBe(400);
    expect((await handlers.log(json({ imdbId: "tt0000001", score: 7.5 }))).status).toBe(400);
    expect((await handlers.log(json({ imdbId: "tt0000001", state: "loved" }))).status).toBe(400);
    expect((await handlers.log(json({ imdbId: "nm0000001", score: 8 }))).status).toBe(400);
    expect((await handlers.log(json({}))).status).toBe(400);
    expect(await store.listWatched("user-1")).toEqual([]);
    expect(await store.listEpisodes("user-1")).toEqual([]);
  });

  // v5 speaks one vocabulary. The old bucket words are not translated any
  // more — they are simply not a rating, and nothing is written.
  it("refuses an old bucket word with a 400 and writes nothing", async () => {
    for (const bucket of ["liked", "meh", "want", "seen", "unseen"]) {
      expect((await handlers.log(json({ imdbId: "tt0000001", rating: bucket }))).status).toBe(400);
    }
    expect(await store.listWatched("user-1")).toEqual([]);
    expect(await store.listEpisodes("user-1")).toEqual([]);
  });

  it("moves the season pointer from the drawer, with the score it already had", async () => {
    await handlers.log(json({ imdbId: "tt0000004", score: 8, season: 2 }));
    expect((await store.listWatched("user-1")).find((r) => r.titleImdbId === "tt0000004")).toMatchObject({ rating: "rated", score: 8, season: 2 });
    await handlers.log(json({ imdbId: "tt0000004", score: 8, season: 3 }));
    expect((await store.listWatched("user-1")).find((r) => r.titleImdbId === "tt0000004")).toMatchObject({ rating: "rated", score: 8, season: 3 });
    // The drawer's two quiet links write the state and drop the score.
    await handlers.log(json({ imdbId: "tt0000004", state: "want", season: 3 }));
    expect((await store.listWatched("user-1")).find((r) => r.titleImdbId === "tt0000004")).toMatchObject({ rating: "want", score: null, season: 3 });
  });

  it("an import warms the titles cache for everything it matched", async () => {
    await handlers.importCsv(json({ ratings: read("ratings.csv") }));
    await Promise.all(scheduled);
    const cached = await titles.getMany(["tt0000001", "tt0000002"]);
    expect(cached.get("tt0000001")).toMatchObject({ name: "Apollo 13" });
    expect(cached.get("tt0000002")).toMatchObject({ name: "Forrest Gump" });
  });
});

describe("taste routes: numbers", () => {
  /** Enough of the titles cache for the route to have runtimes and seasons. */
  async function seedTitles(): Promise<void> {
    await titles.upsertMany([
      { imdbId: "tt0000001", tmdbId: null, kind: "movie", name: "Apollo 13", year: 1995, runtime: 140, seasons: null, genres: ["Drama"], posterPath: "/a.jpg", providers: null, fetchedAt: new Date().toISOString() },
      { imdbId: "tt0000002", tmdbId: null, kind: "movie", name: "Forrest Gump", year: 1994, runtime: 142, seasons: null, genres: ["Drama"], posterPath: null, providers: null, fetchedAt: new Date().toISOString() },
      { imdbId: "tt0000004", tmdbId: null, kind: "series", name: "Long Runner", year: 1990, runtime: 45, seasons: [{ season: 1, episodes: 10 }, { season: 2, episodes: 12 }], genres: ["Drama"], posterPath: null, providers: null, fetchedAt: new Date().toISOString() },
      { imdbId: "tt0000009", tmdbId: null, kind: "series", name: "Good Series", year: 2018, runtime: 50, seasons: [{ season: 1, episodes: 10 }], genres: ["Thriller"], posterPath: null, providers: null, fetchedAt: new Date().toISOString() },
      { imdbId: "tt0000006", tmdbId: null, kind: "series", name: "Mini Series", year: 2010, runtime: 55, seasons: [{ season: 1, episodes: 6 }], genres: ["War"], posterPath: null, providers: null, fetchedAt: new Date().toISOString() },
      { imdbId: "tt0000011", tmdbId: null, kind: "movie", name: "TV Movie", year: 2008, runtime: 90, seasons: null, genres: ["Drama"], posterPath: null, providers: null, fetchedAt: new Date().toISOString() },
    ]);
  }

  it("answers an empty log with empty numbers, not an error", async () => {
    const res = await handlers.numbers(get());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.totals).toMatchObject({ titles: 0, hours: 0 });
    expect(body.log).toEqual([]);
    expect(body.people).toEqual([]);
    // v5 dropped the month chart and the genre rows with the dashboard.
    expect(body.months).toBeUndefined();
    expect(body.genres).toBeUndefined();
  });

  it("computes the page from the watched rows and the titles cache", async () => {
    const now = new Date().toISOString();
    await seedTitles();
    await store.upsertWatched("user-1", [
      { titleImdbId: "tt0000001", rating: "rated", score: 8, source: "log", watchedAt: now },
      { titleImdbId: "tt0000002", rating: "rated", score: 5, source: "letterboxd", watchedAt: now },
      { titleImdbId: "tt0000004", rating: "seen", source: "netflix", watchedAt: now, season: 2 },
      { titleImdbId: "tt0000009", rating: "rated", score: 8, source: "log", watchedAt: now, episodesWatched: 5 },
      { titleImdbId: "tt0000006", rating: "want", source: "log" },
      { titleImdbId: "tt0000011", rating: "seen", source: "imdb" },
    ]);

    const body = await (await handlers.numbers(get())).json();
    // 140 + 142 + (22 x 45) + (5 x 50) + 90 = 1612 minutes; the want row is not watching.
    expect(body.totals).toEqual({ titles: 6, films: 3, shows: 3, hours: 27, liked: 2, meh: 1, seen: 2, want: 1 });
    expect(body.undated).toBe(1);
    expect(body.runtimeFinished).toBe(124);
    expect(body.log).toHaveLength(6);
    expect(body.log.at(-1).watchedAt).toBeNull();
    expect(body.log[0]).toMatchObject({ name: "Apollo 13", kind: "movie", state: "rated", score: 8, posterPath: "/a.jpg" });
  });

  it("hands the people grid a face and upgrades the role TMDB knows", async () => {
    await seedTitles();
    await store.upsertWatched("user-1", [
      { titleImdbId: "tt0000001", rating: "rated", score: 8, source: "log", watchedAt: new Date().toISOString() },
    ]);
    faces = {
      "nm0000002": { url: "https://image.tmdb.test/hanks.jpg", knownAs: "Acting" },
      "nm0000006": { url: null, knownAs: "Directing" },
    };

    const body = await (await handlers.numbers(get())).json();
    const by = Object.fromEntries(body.people.map((p: { imdbId: string }) => [p.imdbId, p]));
    expect(by["nm0000002"]).toMatchObject({ name: "Tom Hanks", face: "https://image.tmdb.test/hanks.jpg", role: "actor" });
    expect(by["nm0000006"]).toMatchObject({ name: "Wes Director", face: null, role: "director" });
    // A person TMDB said nothing about still renders, with no face.
    expect(by["nm0000003"]).toMatchObject({ face: null });
  });

  it("answers from the graph when the titles cache is cold, and warms it after", async () => {
    await store.upsertWatched("user-1", [
      { titleImdbId: "tt0000001", rating: "rated", score: 8, source: "log", watchedAt: new Date().toISOString() },
    ]);
    const body = await (await handlers.numbers(get())).json();
    expect(body.log[0]).toMatchObject({ name: "Apollo 13", year: 1995, kind: "movie", runtime: null });
    await Promise.all(scheduled);
    expect((await titles.getMany(["tt0000001"])).get("tt0000001")).toMatchObject({ name: "Apollo 13" });
  });
});
