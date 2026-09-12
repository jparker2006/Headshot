import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  crawlLetterboxd,
  crawlToInputs,
  isFreshCrawl,
  isValidUsername,
  pageUrl,
  parseDiaryPage,
  parseGridPage,
  parseRss,
  probeLetterboxd,
  titleFromSlug,
  totalOf,
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

/**
 * The whole public profile as Letterboxd serves it to a server today, keyed by
 * the path the crawl asks for: page one of everything answers, the *second*
 * page of films and the diary is a 403, and only the watchlist paginates.
 */
const PAGES: Record<string, string | number> = {
  "/jake/films/": read("films-1.html"),
  "/jake/films/page/2/": 403,
  "/jake/watchlist/": read("watchlist-1.html"),
  "/jake/watchlist/page/2/": read("watchlist-2.html"),
  "/jake/diary/": read("diary-1.html"),
  "/jake/diary/page/2/": 403,
  "/jake/rss/": read("rss.xml"),
};

/** Every request the crawl makes against a live, readable profile. */
const ALL_URLS = [
  "https://letterboxd.com/jake/films/",
  "https://letterboxd.com/jake/films/page/2/",
  "https://letterboxd.com/jake/watchlist/",
  "https://letterboxd.com/jake/watchlist/page/2/",
  "https://letterboxd.com/jake/diary/",
  "https://letterboxd.com/jake/diary/page/2/",
  "https://letterboxd.com/jake/rss/",
];

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

describe("the URLs the crawl asks for", () => {
  it("never asks for page one by number, and puts the diary at its own path", () => {
    // `/jake/films/page/1/` is one of the URLs Letterboxd answers 403 to.
    expect(pageUrl("jake", "films", 1)).toBe("https://letterboxd.com/jake/films/");
    expect(pageUrl("jake", "films", 2)).toBe("https://letterboxd.com/jake/films/page/2/");
    expect(pageUrl("jake", "watchlist", 1)).toBe("https://letterboxd.com/jake/watchlist/");
    expect(pageUrl("jake", "watchlist", 3)).toBe("https://letterboxd.com/jake/watchlist/page/3/");
    // Not `/jake/films/diary/`, which is a 403 and a redirect.
    expect(pageUrl("jake", "diary", 1)).toBe("https://letterboxd.com/jake/diary/");
    expect(pageUrl("jake", "diary", 2)).toBe("https://letterboxd.com/jake/diary/page/2/");
  });
});

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

  it("reads the total out of the section heading", () => {
    // <h1 class="section-heading"><span class="tooltip" title="2,577&nbsp;films">
    expect(totalOf(read("films-1.html"))).toBe(2577);
    expect(parseGridPage(read("films-1.html")).total).toBe(2577);
    // The watchlist heading counts differently; no tooltip, no number.
    expect(parseGridPage(read("watchlist-1.html")).total).toBeNull();
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
      { slug: "apollo-13", name: "Apollo 13", year: 1995, halfStars: 9, watchedAt: "2024-07-30" },
      { slug: "forrest-gump", name: "Forrest Gump", year: 1994, halfStars: 6, watchedAt: "2024-02-11" },
    ]);
  });

  it("reads the date off today's day link and yesterday's", () => {
    // Today: /<user>/diary/films/for/2026/09/08/. Once: /<user>/films/diary/for/…
    const old = '<tr><a href="/jake/films/diary/for/2019/03/04/">4</a><a href="/film/heat/">Heat</a></tr>';
    expect(parseDiaryPage(old).items[0]).toMatchObject({ slug: "heat", watchedAt: "2019-03-04" });
  });
});

describe("parsing the RSS feed", () => {
  it("reads the slug out of a /<user>/film/<slug>/ link, with the rating and the date", () => {
    const items = parseRss(read("rss.xml"));
    // The list entry carries no film link and none of Letterboxd's elements.
    expect(items.map((i) => i.slug)).toEqual(["long-runner", "late-night-show", "mini-series"]);
    expect(items[0]).toEqual({ slug: "long-runner", name: "Long Runner", year: 1990, halfStars: 7, watchedAt: "2026-09-08" });
    // 4.0 stars is the grid's rated-8, so the feed and the page agree.
    expect(items[1]).toMatchObject({ halfStars: 8, watchedAt: "2026-09-05" });
    // No memberRating: watched, opinion unknown.
    expect(items[2]).toMatchObject({ slug: "mini-series", halfStars: null, watchedAt: "2026-09-01" });
  });
});

describe("crawling a profile", () => {
  it("walks films, watchlist, diary and the feed and merges them into one row per title", async () => {
    const rec = recorder();
    const result = await crawlLetterboxd("jake", rec.deps);
    if (!("rows" in result)) throw new Error("expected rows");

    const byName = new Map(result.rows.map((r) => [r.name, r]));
    expect([...byName.keys()].sort()).toEqual([
      "Apollo 13",
      "Forrest Gump",
      "Good Series",
      "Late Night Show",
      "Long Runner",
      "Mini Series",
      "TV Movie",
    ]);
    // rated-9 is 4.5 stars, which `scoreFor` doubles back to a 9.
    expect(byName.get("Apollo 13")).toEqual({ name: "Apollo 13", year: 1995, rating: 4.5, watchedAt: "2024-07-30", list: "watched" });
    expect(byName.get("Forrest Gump")).toMatchObject({ rating: 3, watchedAt: "2024-02-11", list: "watched" });
    // The grid had no rating and no date for this one; the feed had both.
    expect(byName.get("Long Runner")).toMatchObject({ rating: 3.5, watchedAt: "2026-09-08", list: "watched" });
    // A film only the feed knows about is a watch like any other.
    expect(byName.get("Late Night Show")).toMatchObject({ rating: 4, watchedAt: "2026-09-05", list: "watched" });
    // A viewing beats the watchlist, and an unrated one stays unrated.
    expect(byName.get("Mini Series")).toMatchObject({ rating: null, watchedAt: "2026-09-01", list: "watched" });
    expect(byName.get("TV Movie")).toMatchObject({ rating: null, list: "watchlist", watchedAt: null });
  });

  it("reads page one of everything, the watchlist to its end, and the feed", async () => {
    const rec = recorder();
    await crawlLetterboxd("jake", rec.deps);
    expect(rec.urls).toEqual(ALL_URLS);
  });

  it("keeps what it has when Letterboxd refuses page two, and says the import is partial", async () => {
    const rec = recorder();
    const result = await crawlLetterboxd("jake", rec.deps);
    if (!("rows" in result)) throw new Error("expected rows");
    // Films and the diary both stopped on a 403; the four grid films survived.
    expect(result.rows.filter((r) => r.list === "watched")).toHaveLength(6);
    expect(result.partial).toBe(true);
    expect(result.total).toBe(2577);
    expect(result.pages).toBe(ALL_URLS.length);
  });

  it("is not partial when every section simply ran out", async () => {
    const result = await crawlLetterboxd(
      "jake",
      recorder({ "/jake/films/": read("films-1.html"), "/jake/rss/": read("rss.xml") }).deps,
    );
    if (!("rows" in result)) throw new Error("expected rows");
    expect(result.partial).toBe(false);
  });

  it("stops when a page repeats what the last one already carried", async () => {
    // Letterboxd answers past the last page with the last page again.
    const rec = recorder({ "/jake/watchlist/": read("watchlist-1.html"), "/jake/watchlist/page/2/": read("watchlist-1.html") });
    const result = await crawlLetterboxd("jake", { ...rec.deps, maxPages: 10 });
    if (!("rows" in result)) throw new Error("expected rows");
    expect(result.rows).toHaveLength(2);
    expect(rec.urls.filter((u) => u.includes("/watchlist"))).toHaveLength(2);
  });

  it("survives a feed that will not load", async () => {
    const rec = recorder({ ...PAGES, "/jake/rss/": 500 });
    const result = await crawlLetterboxd("jake", rec.deps);
    if (!("rows" in result)) throw new Error("expected rows");
    // Six titles: the feed's extra watch is gone, nothing else is.
    expect(result.rows).toHaveLength(6);
    expect(rec.urls).toEqual(ALL_URLS);
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
    // Then the feed, which is one request whatever happened before it.
    expect(result.pages).toBe(8);
  });

  it("reports a private profile only from the notice, never from a 403", async () => {
    // A 403 on page one is Letterboxd blocking us, not a locked profile.
    expect(await crawlLetterboxd("shy", recorder({ "/shy/films/": 403 }).deps)).toEqual({ blocked: true });

    const notice = await crawlLetterboxd("shy", recorder({ "/shy/films/": read("private.html") }).deps);
    expect(notice).toEqual({ private: true });
  });

  it("reports an unknown user from a 404", async () => {
    expect(await crawlLetterboxd("nobody", recorder({ "/nobody/films/": 404 }).deps)).toEqual({ notFound: true });
  });
});

describe("probing before promising", () => {
  it("answers ok, private, blocked and not_found from page one alone", async () => {
    const rec = recorder();
    expect(await probeLetterboxd("jake", rec.deps)).toEqual({ ok: true });
    expect(rec.urls).toEqual(["https://letterboxd.com/jake/films/"]);
    expect(await probeLetterboxd("shy", recorder({ "/shy/films/": read("private.html") }).deps)).toEqual({ private: true });
    expect(await probeLetterboxd("shy", recorder({ "/shy/films/": 403 }).deps)).toEqual({ blocked: true });
    expect(await probeLetterboxd("nobody", recorder({ "/nobody/films/": 404 }).deps)).toEqual({ notFound: true });
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
    // The feed's 3.5★ on a grid film the page showed unrated.
    expect(byId.get("tt0000004")).toMatchObject({ rating: "rated", score: 7, watchedAt: "2026-09-08T00:00:00.000Z" });
    // Only the feed knew about this one, and it still lands as a rating.
    expect(byId.get("tt0000003")).toMatchObject({ rating: "rated", score: 8, watchedAt: "2026-09-05T00:00:00.000Z" });
    // An unrated viewing is `seen`, and it takes the title off the watchlist.
    expect(byId.get("tt0000006")).toMatchObject({ rating: "seen", score: null, watchedAt: "2026-09-01T00:00:00.000Z" });
    // Still only wanted: nothing has watched it.
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
