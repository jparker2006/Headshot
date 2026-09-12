import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  crawlLetterboxd,
  crawlToInputs,
  isFreshCrawl,
  isValidUsername,
  parseDiaryPage,
  parseGridPage,
  probeLetterboxd,
  titleFromSlug,
  CRAWL_DELAY_MS,
  MAX_PAGES,
  USER_AGENT,
  type CrawlDeps,
} from "@/lib/taste/letterboxdCrawl";
import { MemoryTasteStore } from "@/lib/taste/memory";
import type { CrawlRow } from "@/lib/taste/types";
import { fixtureGraph } from "../agent/helpers";

const DIR = path.join(__dirname, "..", "fixtures", "letterboxd");
const read = (name: string) => fs.readFileSync(path.join(DIR, name), "utf8");

/** The whole public profile as fixture HTML, keyed by the path the crawl asks for. */
const PAGES: Record<string, string> = {
  "/jake/films/page/1/": read("films-1.html"),
  "/jake/films/page/2/": read("films-2.html"),
  "/jake/watchlist/page/1/": read("watchlist-1.html"),
  "/jake/watchlist/page/2/": read("watchlist-2.html"),
  "/jake/films/diary/page/1/": read("diary-1.html"),
  "/jake/films/diary/page/2/": read("diary-2.html"),
};

interface Recorder {
  urls: string[];
  headers: Record<string, string>[];
  sleeps: number[];
  deps: CrawlDeps;
}

/**
 * A crawl wired to fixtures: every request is recorded, every wait is recorded
 * and returns immediately, and the clock never moves on its own.
 */
function recorder(pages: Record<string, string | number> = PAGES, opts: Partial<CrawlDeps> = {}): Recorder {
  const urls: string[] = [];
  const headers: Record<string, string>[] = [];
  const sleeps: number[] = [];
  const deps: CrawlDeps = {
    fetch: async (url, init) => {
      urls.push(url);
      headers.push(init.headers);
      const body = pages[new URL(url).pathname];
      if (body === undefined) return { status: 200, text: async () => "<html><ul></ul></html>" };
      if (typeof body === "number") return { status: body, text: async () => read("not-found.html") };
      return { status: 200, text: async () => body };
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    now: () => new Date("2026-09-11T12:00:00.000Z"),
    ...opts,
  };
  return { urls, headers, sleeps, deps };
}

describe("parsing a poster grid", () => {
  it("reads slug, title, year and the rating class", () => {
    const page = parseGridPage(read("films-1.html"));
    expect(page.private).toBe(false);
    expect(page.items.map((i) => i.slug)).toEqual(["apollo-13", "forrest-gump", "good-series", "long-runner"]);
    expect(page.items[0]).toEqual({ slug: "apollo-13", name: "Apollo 13", year: 1995, halfStars: 9, watchedAt: null });
    // Half-stars are Letterboxd's own scale: rated-6 is three stars.
    expect(page.items[1].halfStars).toBe(6);
    expect(page.items[2].halfStars).toBe(10);
    // Logged with no rating: the crawl says nothing rather than guessing.
    expect(page.items[3].halfStars).toBeNull();
  });

  it("reads a watchlist grid, which carries no ratings at all", () => {
    const page = parseGridPage(read("watchlist-1.html"));
    expect(page.items.map((i) => i.slug)).toEqual(["mini-series", "tv-movie"]);
    expect(page.items.every((i) => i.halfStars === null)).toBe(true);
  });

  it("sees an empty grid as empty and a private profile as private", () => {
    expect(parseGridPage(read("films-2.html")).items).toEqual([]);
    const shy = parseGridPage(read("private.html"));
    expect(shy.items).toEqual([]);
    expect(shy.private).toBe(true);
  });

  it("falls back to the slug for the title, with the year suffix split off", () => {
    expect(titleFromSlug("the-thing-1982")).toEqual({ name: "the thing", year: 1982 });
    // Not every trailing number is a year.
    expect(titleFromSlug("apollo-13")).toEqual({ name: "apollo 13", year: null });
    expect(parseGridPage('<li><a href="/film/heat/">x</a></li>').items[0]).toMatchObject({ slug: "heat", name: "heat" });
  });
});

describe("parsing the diary", () => {
  it("reads one row per viewing with its date and rating", () => {
    const page = parseDiaryPage(read("diary-1.html"));
    expect(page.items).toEqual([
      { slug: "apollo-13", name: "Apollo 13", year: null, halfStars: 9, watchedAt: "2024-07-30" },
      { slug: "forrest-gump", name: "Forrest Gump", year: null, halfStars: 6, watchedAt: "2024-02-11" },
    ]);
  });
});

describe("crawling a profile", () => {
  it("walks films, watchlist and diary and merges them into one row per title", async () => {
    const rec = recorder();
    const result = await crawlLetterboxd("jake", rec.deps);
    if (!("rows" in result)) throw new Error("expected rows");

    const byName = new Map(result.rows.map((r) => [r.name, r]));
    expect([...byName.keys()].sort()).toEqual(["Apollo 13", "Forrest Gump", "Good Series", "Long Runner", "Mini Series", "TV Movie"]);
    // rated-9 is 4.5 stars, which `scoreFor` doubles back to a 9.
    expect(byName.get("Apollo 13")).toEqual({ name: "Apollo 13", year: 1995, rating: 4.5, watchedAt: "2024-07-30", list: "watched" });
    expect(byName.get("Forrest Gump")).toMatchObject({ rating: 3, watchedAt: "2024-02-11", list: "watched" });
    // Watched but unrated stays unrated; the watchlist is `watchlist`.
    expect(byName.get("Long Runner")).toMatchObject({ rating: null, list: "watched", watchedAt: null });
    expect(byName.get("Mini Series")).toMatchObject({ rating: null, list: "watchlist", watchedAt: null });
  });

  it("stops on an empty page and never asks for a third", async () => {
    const rec = recorder();
    await crawlLetterboxd("jake", rec.deps);
    expect(rec.urls).toEqual([
      "https://letterboxd.com/jake/films/page/1/",
      "https://letterboxd.com/jake/films/page/2/",
      "https://letterboxd.com/jake/watchlist/page/1/",
      "https://letterboxd.com/jake/watchlist/page/2/",
      "https://letterboxd.com/jake/films/diary/page/1/",
      "https://letterboxd.com/jake/films/diary/page/2/",
    ]);
  });

  it("stops when a page repeats what the last one already carried", async () => {
    // Letterboxd answers past the last page with the last page again.
    const rec = recorder({ "/jake/films/page/1/": read("films-1.html"), "/jake/films/page/2/": read("films-1.html") });
    const result = await crawlLetterboxd("jake", { ...rec.deps, maxPages: 10 });
    if (!("rows" in result)) throw new Error("expected rows");
    expect(result.rows).toHaveLength(4);
    expect(rec.urls.filter((u) => u.includes("/films/page/"))).toHaveLength(2);
  });

  it("waits 300ms between requests and never before the first", async () => {
    const rec = recorder();
    await crawlLetterboxd("jake", rec.deps);
    expect(rec.sleeps).toEqual(Array(rec.urls.length - 1).fill(CRAWL_DELAY_MS));
    expect(CRAWL_DELAY_MS).toBe(300);
    expect(MAX_PAGES).toBe(200);
  });

  it("sends a real browser User-Agent", async () => {
    const rec = recorder();
    await crawlLetterboxd("jake", rec.deps);
    expect(rec.headers[0]["user-agent"]).toBe(USER_AGENT);
    expect(USER_AGENT).toMatch(/Mozilla\/5\.0/);
  });

  it("caps the walk at maxPages", async () => {
    // A profile that answers every page with fresh items would walk forever.
    let n = 0;
    const deps: CrawlDeps = {
      fetch: async () => ({ status: 200, text: async () => `<li><a href="/film/film-${n++}/">x</a></li>` }),
      sleep: async () => {},
    };
    const result = await crawlLetterboxd("jake", { ...deps, maxPages: 3 });
    if (!("rows" in result)) throw new Error("expected rows");
    // Three pages each for films and the watchlist; the diary reads table
    // rows, finds none in this grid markup, and stops after its first page.
    expect(result.pages).toBe(7);
  });

  it("reports a private profile from a 403 and from the notice on page 1", async () => {
    const forbidden = await crawlLetterboxd("shy", recorder({ "/shy/films/page/1/": 403 }).deps);
    expect(forbidden).toEqual({ private: true });

    const notice = await crawlLetterboxd("shy", recorder({ "/shy/films/page/1/": read("private.html") }).deps);
    expect(notice).toEqual({ private: true });
  });

  it("reports an unknown user from a 404", async () => {
    expect(await crawlLetterboxd("nobody", recorder({ "/nobody/films/page/1/": 404 }).deps)).toEqual({ notFound: true });
  });
});

describe("probing before promising", () => {
  it("answers ok, private and not_found from page one alone", async () => {
    const rec = recorder();
    expect(await probeLetterboxd("jake", rec.deps)).toEqual({ ok: true });
    expect(rec.urls).toEqual(["https://letterboxd.com/jake/films/page/1/"]);
    expect(await probeLetterboxd("shy", recorder({ "/shy/films/page/1/": read("private.html") }).deps)).toEqual({ private: true });
    expect(await probeLetterboxd("shy", recorder({ "/shy/films/page/1/": 403 }).deps)).toEqual({ private: true });
    expect(await probeLetterboxd("nobody", recorder({ "/nobody/films/page/1/": 404 }).deps)).toEqual({ notFound: true });
  });
});

describe("writing the crawl to the store", () => {
  it("matches through the existing matcher and replaces the letterboxd import", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    const result = await crawlLetterboxd("jake", recorder().deps);
    if (!("rows" in result)) throw new Error("expected rows");

    const { inputs } = crawlToInputs(graph, result.rows);
    await store.replaceImport("u1", "letterboxd", inputs);
    const rows = await store.listWatched("u1");
    const byId = new Map(rows.map((r) => [r.titleImdbId, r]));

    expect(byId.get("tt0000001")).toMatchObject({ rating: "rated", score: 9, source: "letterboxd", watchedAt: "2024-07-30T00:00:00.000Z" });
    expect(byId.get("tt0000002")).toMatchObject({ rating: "rated", score: 6, source: "letterboxd" });
    expect(byId.get("tt0000009")).toMatchObject({ rating: "rated", score: 10 });
    // Watched with no rating is `seen`; the watchlist is `want`.
    expect(byId.get("tt0000004")).toMatchObject({ rating: "seen", score: null });
    expect(byId.get("tt0000006")).toMatchObject({ rating: "want", score: null });
    expect(byId.get("tt0000011")).toMatchObject({ rating: "want", score: null });
  });

  it("records and reads the crawl row", async () => {
    const store = new MemoryTasteStore();
    expect(await store.getCrawl("u1", "letterboxd")).toBeNull();
    const started = await store.startCrawl("u1", "letterboxd", "jake");
    expect(started).toMatchObject({ username: "jake", status: "running", imported: 0, finishedAt: null });
    const done = await store.finishCrawl("u1", "letterboxd", { status: "done", imported: 6 });
    expect(done).toMatchObject({ username: "jake", status: "done", imported: 6 });
    expect(done.finishedAt).not.toBeNull();
    expect(await store.getCrawl("u2", "letterboxd")).toBeNull();
  });
});

describe("the 24h cache", () => {
  const row = (over: Partial<CrawlRow> = {}): CrawlRow => ({
    source: "letterboxd",
    username: "jake",
    status: "done",
    imported: 6,
    startedAt: "2026-09-10T12:00:00.000Z",
    finishedAt: "2026-09-10T12:00:00.000Z",
    error: null,
    ...over,
  });
  const at = (iso: string) => new Date(iso);

  it("is fresh inside the window for the same username and stale outside it", () => {
    expect(isFreshCrawl(row(), "jake", at("2026-09-10T20:00:00.000Z"))).toBe(true);
    expect(isFreshCrawl(row(), "JAKE", at("2026-09-10T20:00:00.000Z"))).toBe(true);
    expect(isFreshCrawl(row(), "jake", at("2026-09-11T13:00:00.000Z"))).toBe(false);
    expect(isFreshCrawl(row(), "someoneelse", at("2026-09-10T20:00:00.000Z"))).toBe(false);
    expect(isFreshCrawl(null, "jake", at("2026-09-10T20:00:00.000Z"))).toBe(false);
  });

  it("never caches a run that did not finish with rows", () => {
    for (const status of ["running", "private", "not_found", "failed"] as const) {
      expect(isFreshCrawl(row({ status, finishedAt: status === "running" ? null : "2026-09-10T12:00:00.000Z" }), "jake", at("2026-09-10T13:00:00.000Z"))).toBe(false);
    }
  });
});

describe("usernames", () => {
  it("accepts what Letterboxd accepts and nothing else", () => {
    expect(isValidUsername("jake")).toBe(true);
    expect(isValidUsername("a_1")).toBe(true);
    expect(isValidUsername("a")).toBe(false);
    expect(isValidUsername("a".repeat(16))).toBe(false);
    expect(isValidUsername("jake/../admin")).toBe(false);
    expect(isValidUsername("jake-parker")).toBe(false);
    expect(isValidUsername(42)).toBe(false);
  });
});
