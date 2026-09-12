/**
 * The Letterboxd import route (SPEC v5): a username in, a background crawl,
 * and a status the Log page can poll. Everything the world usually supplies —
 * the network, the clock, `waitUntil` — is injected, so this is a fast, exact
 * test of the contract and never touches letterboxd.com.
 */
import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createTasteHandlers } from "@/lib/taste/routes";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { fixtureGraph } from "../agent/helpers";

const DIR = path.join(__dirname, "..", "fixtures", "letterboxd");
const read = (name: string) => fs.readFileSync(path.join(DIR, name), "utf8");

const PAGES: Record<string, string | number> = {
  "/jake/films/": read("films-1.html"),
  // Letterboxd answers a server 403 on every films/diary page past the first.
  "/jake/films/page/2/": 403,
  "/jake/watchlist/": read("watchlist-1.html"),
  "/jake/watchlist/page/2/": read("watchlist-2.html"),
  "/jake/diary/": read("diary-1.html"),
  "/jake/diary/page/2/": 403,
  "/jake/rss/": read("rss.xml"),
  "/shy/films/": read("private.html"),
  "/nobody/films/": 404,
  "/broken/films/": 500,
  "/walled/films/": 403,
};

let store: MemoryTasteStore;
let signedInAs: string | null;
let scheduled: Promise<void>[];
let rewrites: string[];
let clock: Date;
let requests: string[];

const handlers = createTasteHandlers({
  userId: async () => signedInAs,
  store: async () => store,
  graph: fixtureGraph,
  schedule: (work) => scheduled.push(work()),
  rewrite: async (userId) => {
    rewrites.push(userId);
  },
  crawl: {
    fetch: async (url) => {
      requests.push(url);
      const body = PAGES[new URL(url).pathname];
      if (body === undefined) return { status: 200, text: async () => "<html><ul></ul></html>" };
      if (typeof body === "number") return { status: body, text: async () => read("not-found.html") };
      return { status: 200, text: async () => body };
    },
    sleep: async () => {},
    now: () => clock,
  },
});

/** Everything the route scheduled behind `waitUntil`, finished. */
const settle = () => Promise.all(scheduled);

beforeEach(() => {
  store = new MemoryTasteStore({ now: () => clock });
  signedInAs = "user-1";
  scheduled = [];
  rewrites = [];
  requests = [];
  clock = new Date("2026-09-11T12:00:00.000Z");
});

const post = (body: unknown) =>
  new Request("https://headshot.test/api/taste/import/letterboxd", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const get = () => new Request("https://headshot.test/api/taste/import/letterboxd");

describe("POST /api/taste/import/letterboxd", () => {
  it("refuses a signed-out request", async () => {
    signedInAs = null;
    expect((await handlers.startLetterboxdCrawl(post({ username: "jake" }))).status).toBe(401);
    expect((await handlers.letterboxdCrawlStatus(get())).status).toBe(401);
  });

  it("rejects anything that is not a Letterboxd username", async () => {
    for (const username of ["a", "a".repeat(16), "jake parker", "jake/../admin", "", 7, undefined]) {
      const res = await handlers.startLetterboxdCrawl(post({ username }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_username" });
    }
    expect(requests).toEqual([]);
  });

  it("answers 202, then imports the whole profile in the background", async () => {
    const res = await handlers.startLetterboxdCrawl(post({ username: "jake" }));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ started: true, username: "jake" });

    // Page one was read inside the request; the walk is still pending.
    expect(await store.getCrawl("user-1", "letterboxd")).toMatchObject({ username: "jake", status: "running", imported: 0, finishedAt: null });
    expect(await store.listWatched("user-1")).toEqual([]);

    await settle();

    const rows = await store.listWatched("user-1");
    const byId = new Map(rows.map((r) => [r.titleImdbId, r]));
    expect(byId.get("tt0000001")).toMatchObject({ rating: "rated", score: 9, source: "letterboxd", watchedAt: "2024-07-30T00:00:00.000Z" });
    expect(byId.get("tt0000002")).toMatchObject({ rating: "rated", score: 6 });
    // The RSS feed's rating and date, on a film the grid showed unrated.
    expect(byId.get("tt0000004")).toMatchObject({ rating: "rated", score: 7 });
    expect(byId.get("tt0000011")).toMatchObject({ rating: "want" });

    expect(await store.getCrawl("user-1", "letterboxd")).toMatchObject({ status: "done", imported: rows.length });
    // The import is evidence, and the memory is rewritten once the rows land.
    // The line admits what Letterboxd would not show us.
    expect((await store.listEpisodes("user-1"))[0].text).toBe(
      `imported ${rows.length} of ~2,577 titles from Letterboxd (@jake); letterboxd only shows the recent pages`,
    );
    expect(rewrites).toEqual(["user-1"]);
  });

  it("fails with the CSV fallback when Letterboxd blocks the page itself", async () => {
    const res = await handlers.startLetterboxdCrawl(post({ username: "walled" }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "letterboxd_unavailable" });
    // Blocked is not private: the profile is fine, the door is not.
    expect(await store.getCrawl("user-1", "letterboxd")).toMatchObject({ status: "failed", error: "blocked" });
    expect(requests).toEqual(["https://letterboxd.com/walled/films/"]);
  });

  it("says a private profile is private, inside the request, and imports nothing", async () => {
    const res = await handlers.startLetterboxdCrawl(post({ username: "shy" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ private: true, username: "shy" });
    await settle();
    expect(await store.listWatched("user-1")).toEqual([]);
    expect(await store.getCrawl("user-1", "letterboxd")).toMatchObject({ username: "shy", status: "private", imported: 0 });
    // One request: page one told us everything.
    expect(requests).toEqual(["https://letterboxd.com/shy/films/"]);
  });

  it("404s an unknown user", async () => {
    const res = await handlers.startLetterboxdCrawl(post({ username: "nobody" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found", username: "nobody" });
    expect(await store.getCrawl("user-1", "letterboxd")).toMatchObject({ status: "not_found" });
  });

  it("502s when Letterboxd itself is broken, and records the failure", async () => {
    const res = await handlers.startLetterboxdCrawl(post({ username: "broken" }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "letterboxd_unavailable" });
    expect(await store.getCrawl("user-1", "letterboxd")).toMatchObject({ status: "failed", error: expect.stringContaining("500") });
  });

  it("does not crawl the same username twice inside 24 hours", async () => {
    await handlers.startLetterboxdCrawl(post({ username: "jake" }));
    await settle();
    const imported = (await store.getCrawl("user-1", "letterboxd"))!.imported;
    const requestsAfterFirst = requests.length;

    clock = new Date("2026-09-11T20:00:00.000Z");
    const cached = await handlers.startLetterboxdCrawl(post({ username: "jake" }));
    expect(cached.status).toBe(200);
    expect(await cached.json()).toEqual({ cached: true, username: "jake", finishedAt: "2026-09-11T12:00:00.000Z", imported });
    expect(requests).toHaveLength(requestsAfterFirst);

    // `force` is the way through, and so is the passage of a day.
    scheduled = [];
    const forced = await handlers.startLetterboxdCrawl(post({ username: "jake", force: true }));
    expect(forced.status).toBe(202);
    await settle();
    expect(requests.length).toBeGreaterThan(requestsAfterFirst);

    clock = new Date("2026-09-13T12:00:00.000Z");
    scheduled = [];
    expect((await handlers.startLetterboxdCrawl(post({ username: "jake" }))).status).toBe(202);
    await settle();
  });

  it("crawls a different username even inside the window", async () => {
    await handlers.startLetterboxdCrawl(post({ username: "jake" }));
    await settle();
    const res = await handlers.startLetterboxdCrawl(post({ username: "shy" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ private: true, username: "shy" });
  });
});

describe("GET /api/taste/import/letterboxd", () => {
  it("is idle before anything, running during, and done after", async () => {
    expect(await (await handlers.letterboxdCrawlStatus(get())).json()).toEqual({ status: "idle" });

    await handlers.startLetterboxdCrawl(post({ username: "jake" }));
    expect(await (await handlers.letterboxdCrawlStatus(get())).json()).toMatchObject({
      status: "running",
      username: "jake",
      imported: 0,
      startedAt: "2026-09-11T12:00:00.000Z",
      finishedAt: null,
    });

    await settle();
    const done = (await (await handlers.letterboxdCrawlStatus(get())).json()) as { status: string; imported: number; finishedAt: string };
    expect(done.status).toBe("done");
    expect(done.imported).toBeGreaterThan(0);
    expect(done.finishedAt).toBe("2026-09-11T12:00:00.000Z");
  });

  it("reports a failed crawl with its message", async () => {
    await handlers.startLetterboxdCrawl(post({ username: "broken" }));
    expect(await (await handlers.letterboxdCrawlStatus(get())).json()).toMatchObject({ status: "failed", error: expect.stringContaining("500") });
  });

  it("is per user", async () => {
    await handlers.startLetterboxdCrawl(post({ username: "jake" }));
    await settle();
    signedInAs = "user-2";
    expect(await (await handlers.letterboxdCrawlStatus(get())).json()).toEqual({ status: "idle" });
  });
});
