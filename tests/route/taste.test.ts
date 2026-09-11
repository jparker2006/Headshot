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

let store: MemoryTasteStore;
let titles: MemoryTitlesStore;
/** Flipped per test to stand in for the session. */
let signedInAs: string | null;
/** Background warms the route scheduled; tests await them explicitly. */
let scheduled: Promise<void>[];

const handlers = createTasteHandlers({
  userId: async () => signedInAs,
  store: async () => store,
  graph: fixtureGraph,
  titles: async () => titles,
  // No TMDB in tests: a warm is a no-op beyond the graph half.
  tmdb: () => null,
  schedule: (work) => scheduled.push(work()),
});

beforeEach(() => {
  store = new MemoryTasteStore();
  titles = new MemoryTitlesStore();
  signedInAs = "user-1";
  scheduled = [];
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
      handlers.importLetterboxd(json({ ratings: read("ratings.csv") })),
      handlers.confirmImport(json({ fixes: [] })),
      handlers.log(json({ query: "Apollo" })),
      handlers.log(json({ imdbId: "tt0000001", rating: "liked" })),
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
    const res = await handlers.importLetterboxd(json(files));
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
    const res = await handlers.importLetterboxd(
      new Request("https://headshot.test/api/taste/import", { method: "POST", body: form }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).imported).toBe(6);
  });

  it("re-upload replaces the previous import", async () => {
    await handlers.importLetterboxd(json(files));
    await handlers.importLetterboxd(json({ ratings: "Date,Name,Year,Letterboxd URI,Rating\n2024-01-05,Apollo 13,1995,u,4.5\n" }));
    expect((await store.listWatched("user-1")).map((r) => r.titleImdbId)).toEqual(["tt0000001"]);
  });

  it("refuses an upload with no CSVs in it", async () => {
    const res = await handlers.importLetterboxd(json({}));
    expect(res.status).toBe(400);
  });
});

describe("taste routes: import confirm", () => {
  const files = { ratings: read("ratings.csv"), watched: read("watched.csv"), watchlist: read("watchlist.csv") };

  it("re-points a wrong match and keeps the bucket it already had", async () => {
    await handlers.importLetterboxd(json(files));
    // "Late Night" matched Late Night Show at 0.5; the user says it is Long Runner.
    const res = await handlers.confirmImport(json({ fixes: [{ name: "Late Night", year: 2001, imdbId: "tt0000004" }] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ corrected: 1, dropped: 0 });

    const rows = await store.listWatched("user-1");
    expect(rows.find((r) => r.titleImdbId === "tt0000003")).toBeUndefined();
    // tt0000004 was already "meh" from the unrated Long Runner row and stays so.
    expect(rows.find((r) => r.titleImdbId === "tt0000004")?.rating).toBe("meh");
  });

  it("drops a row when the user says none of the matches are it", async () => {
    await handlers.importLetterboxd(json(files));
    const res = await handlers.confirmImport(json({ fixes: [{ name: "Mini Series", year: 2011, imdbId: null }] }));
    expect(await res.json()).toMatchObject({ corrected: 0, dropped: 1 });
    expect((await store.listWatched("user-1")).some((r) => r.titleImdbId === "tt0000006")).toBe(false);
  });

  it("files a previously unmatched row under the bucket the client names", async () => {
    await handlers.importLetterboxd(json(files));
    const res = await handlers.confirmImport(
      json({ fixes: [{ name: "Good Night, and Good Luck.", year: 2005, imdbId: "tt0000011", rating: "liked" }] }),
    );
    expect(await res.json()).toMatchObject({ corrected: 1 });
    expect((await store.listWatched("user-1")).find((r) => r.titleImdbId === "tt0000011")?.rating).toBe("liked");
  });

  it("rejects a body without fixes", async () => {
    expect((await handlers.confirmImport(json({}))).status).toBe(400);
  });
});

describe("taste routes: watched", () => {
  it("lists what the store holds for the signed-in user", async () => {
    await store.upsertWatched("user-1", [{ titleImdbId: "tt0000001", rating: "liked", source: "swipe" }]);
    await store.upsertWatched("someone-else", [{ titleImdbId: "tt0000002", rating: "meh", source: "swipe" }]);

    const body = await (await handlers.listWatched(get())).json();
    expect(body.watched).toMatchObject([{ titleImdbId: "tt0000001", rating: "liked", source: "swipe" }]);
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
    const res = await handlers.log(json({ imdbId: "tt0000001", rating: "liked", text: 'the "reentry" bit still gets me' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.row).toMatchObject({ titleImdbId: "tt0000001", rating: "liked", source: "log" });
    expect(typeof body.row.watchedAt).toBe("string");

    expect(await store.listWatched("user-1")).toMatchObject([{ titleImdbId: "tt0000001", rating: "liked", source: "log" }]);
    const episodes = await store.listEpisodes("user-1");
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ kind: "log", titleImdbId: "tt0000001" });
    // The user's own words, unparaphrased.
    expect(episodes[0].text).toBe('liked Apollo 13 (1995): "the \"reentry\" bit still gets me"');

    // The titles cache is warmed in the background, never on the way out.
    await Promise.all(scheduled);
    expect((await titles.getMany(["tt0000001"])).get("tt0000001")).toMatchObject({ name: "Apollo 13", year: 1995 });
  });

  it("logs a season of a show, and the neutral `seen` bucket", async () => {
    await handlers.log(json({ imdbId: "tt0000003", rating: "seen", season: 2 }));
    expect(await store.listWatched("user-1")).toMatchObject([{ titleImdbId: "tt0000003", rating: "seen", season: 2, source: "log" }]);
    expect((await store.listEpisodes("user-1"))[0].text).toBe("seen Late Night Show (2001)");
  });

  it("refuses a bucket the log does not offer and a body that says nothing", async () => {
    expect((await handlers.log(json({ imdbId: "tt0000001", rating: "unseen" }))).status).toBe(400);
    expect((await handlers.log(json({ imdbId: "nm0000001", rating: "liked" }))).status).toBe(400);
    expect((await handlers.log(json({}))).status).toBe(400);
    expect(await store.listWatched("user-1")).toEqual([]);
    expect(await store.listEpisodes("user-1")).toEqual([]);
  });

  it("an import warms the titles cache for everything it matched", async () => {
    await handlers.importLetterboxd(json({ ratings: read("ratings.csv") }));
    await Promise.all(scheduled);
    const cached = await titles.getMany(["tt0000001", "tt0000002"]);
    expect(cached.get("tt0000001")).toMatchObject({ name: "Apollo 13" });
    expect(cached.get("tt0000002")).toMatchObject({ name: "Forrest Gump" });
  });
});
