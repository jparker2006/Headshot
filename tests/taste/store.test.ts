import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import { EMBEDDING_DIMS } from "@/lib/brain/schema";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { PostgresTasteStore } from "@/lib/taste/postgres";
import { EMPTY_TASTE_FACTS, type TasteFacts, type TasteStore } from "@/lib/taste/types";
import { MemoryTitlesStore } from "@/lib/titles/memory";
import { PostgresTitlesStore } from "@/lib/titles/postgres";
import type { TitleRow, TitlesStore } from "@/lib/titles/types";

const MIGRATIONS = path.join(__dirname, "..", "..", "drizzle");

/** A taste-store factory: fresh, empty, with an optional injected clock. */
type StoreFactory = (opts?: { now?: () => Date }) => Promise<TasteStore>;

let client: PGlite;
let db: PgliteDatabase;

beforeAll(async () => {
  client = new PGlite({ extensions: { vector } });
  await client.waitReady;
  db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS });
}, 120_000);

afterAll(async () => {
  await client?.close();
});

async function truncate() {
  await db.execute(
    sql`truncate table "page_revisions", "pages", "nodes", "overlay_edges", "questions", "embeddings", "answers", "watched", "services", "taste", "tonight", "titles", "memory", "episodes", "threads", "messages"`,
  );
}

/** A 512-wide vector with the given leading components. */
function vec(...leading: number[]): number[] {
  const v = new Array<number>(EMBEDDING_DIMS).fill(0);
  leading.forEach((x, i) => (v[i] = x));
  return v;
}

const FACTS: TasteFacts = {
  people: [{ imdbId: "nm0000001", name: "Kevin Bacon", count: 4 }],
  eras: { "1990s": 7, "2010s": 3 },
  avgRuntimeFinished: 112,
  tvShare: 0.4,
  genresAvoided: ["Horror"],
};

/** Every behavioural assertion both taste stores must satisfy. */
function describeStore(name: string, factory: StoreFactory) {
  describe(name, () => {
    it("upsertWatched inserts, updates in place, and keeps users apart", async () => {
      const store = await factory();
      await store.upsertWatched("u1", [
        { titleImdbId: "tt2", rating: "rated", score: 8, source: "letterboxd", watchedAt: "2024-01-05T00:00:00.000Z" },
        { titleImdbId: "tt1", rating: "want", source: "swipe" },
      ]);
      await store.upsertWatched("u2", [{ titleImdbId: "tt1", rating: "rated", score: 5, source: "chat" }]);
      await store.upsertWatched("u1", [{ titleImdbId: "tt1", rating: "rated", score: 8, source: "swipe" }]);

      const rows = await store.listWatched("u1");
      // Ordered by title id so the list is stable between reads.
      expect(rows.map((r) => r.titleImdbId)).toEqual(["tt1", "tt2"]);
      expect(rows[0]).toMatchObject({ rating: "rated", score: 8, source: "swipe", watchedAt: null, season: null, episodesWatched: 0 });
      expect(rows[1]).toMatchObject({ rating: "rated", score: 8, source: "letterboxd", watchedAt: "2024-01-05T00:00:00.000Z" });
      expect(rows.every((r) => typeof r.updatedAt === "string")).toBe(true);

      expect(await store.listWatched("u2")).toMatchObject([{ titleImdbId: "tt1", rating: "rated", score: 5, source: "chat" }]);
      expect(await store.listWatched("nobody")).toEqual([]);
    });

    it("the last row wins when one call mentions a title twice", async () => {
      const store = await factory();
      await store.upsertWatched("u1", [
        { titleImdbId: "tt1", rating: "rated", score: 5, source: "swipe" },
        { titleImdbId: "tt1", rating: "rated", score: 8, source: "swipe" },
      ]);
      expect(await store.listWatched("u1")).toMatchObject([{ titleImdbId: "tt1", rating: "rated", score: 8 }]);
    });

    it("deleteWatched removes one row for one user", async () => {
      const store = await factory();
      await store.upsertWatched("u1", [
        { titleImdbId: "tt1", rating: "rated", score: 8, source: "swipe" },
        { titleImdbId: "tt2", rating: "rated", score: 5, source: "swipe" },
      ]);
      await store.upsertWatched("u2", [{ titleImdbId: "tt1", rating: "rated", score: 8, source: "swipe" }]);
      await store.deleteWatched("u1", "tt1");

      expect((await store.listWatched("u1")).map((r) => r.titleImdbId)).toEqual(["tt2"]);
      expect((await store.listWatched("u2")).map((r) => r.titleImdbId)).toEqual(["tt1"]);
    });

    it("replaceImport drops only the previous rows of that source", async () => {
      const store = await factory();
      await store.upsertWatched("u1", [
        { titleImdbId: "tt-swipe", rating: "rated", score: 8, source: "swipe" },
        { titleImdbId: "tt-chat", rating: "want", source: "chat" },
      ]);
      await store.replaceImport("u1", "letterboxd", [
        { titleImdbId: "tt-a", rating: "rated", score: 8, source: "letterboxd" },
        { titleImdbId: "tt-b", rating: "rated", score: 5, source: "letterboxd" },
      ]);
      await store.replaceImport("u1", "letterboxd", [{ titleImdbId: "tt-a", rating: "rated", score: 5, source: "letterboxd" }]);

      const rows = await store.listWatched("u1");
      expect(rows.map((r) => r.titleImdbId)).toEqual(["tt-a", "tt-chat", "tt-swipe"]);
      expect(rows.find((r) => r.titleImdbId === "tt-a")).toMatchObject({ rating: "rated", score: 5, source: "letterboxd" });
    });

    it("one import source never disturbs another", async () => {
      const store = await factory();
      await store.replaceImport("u1", "letterboxd", [{ titleImdbId: "tt-lb", rating: "rated", score: 8, source: "letterboxd" }]);
      await store.replaceImport("u1", "netflix", [
        { titleImdbId: "tt-nf1", rating: "seen", source: "netflix" },
        { titleImdbId: "tt-nf2", rating: "seen", source: "netflix" },
      ]);
      await store.replaceImport("u1", "imdb", [{ titleImdbId: "tt-imdb", rating: "rated", score: 5, source: "imdb" }]);

      // A Netflix re-upload replaces only the Netflix rows.
      await store.replaceImport("u1", "netflix", [{ titleImdbId: "tt-nf2", rating: "seen", source: "netflix" }]);
      const rows = await store.listWatched("u1");
      expect(rows.map((r) => r.titleImdbId)).toEqual(["tt-imdb", "tt-lb", "tt-nf2"]);
      expect(rows.map((r) => r.source)).toEqual(["imdb", "letterboxd", "netflix"]);
    });

    it("replaceImport stamps the source even when the caller forgot", async () => {
      const store = await factory();
      await store.replaceImport("u1", "letterboxd", [{ titleImdbId: "tt-a", rating: "rated", score: 8, source: "swipe" }]);
      expect(await store.listWatched("u1")).toMatchObject([{ source: "letterboxd" }]);
    });

    it("the neutral `seen` bucket round-trips", async () => {
      const store = await factory();
      await store.upsertWatched("u1", [{ titleImdbId: "tt-seen", rating: "seen", source: "log", watchedAt: "2026-09-11T00:00:00.000Z" }]);
      expect(await store.listWatched("u1")).toMatchObject([
        { titleImdbId: "tt-seen", rating: "seen", source: "log", watchedAt: "2026-09-11T00:00:00.000Z" },
      ]);
    });

    it("memory starts empty, round-trips, and updates one field at a time", async () => {
      const store = await factory();
      expect(await store.getMemory("u1")).toBeNull();

      await store.setMemory("u1", { markdown: "- likes long films\n- hates jump scares" });
      expect(await store.getMemory("u1")).toMatchObject({ markdown: "- likes long films\n- hates jump scares", pinned: "" });

      // The user pins a line; the prose the rewrite job owns is untouched.
      await store.setMemory("u1", { pinned: "- I will never watch a musical" });
      const both = await store.getMemory("u1");
      expect(both?.markdown).toBe("- likes long films\n- hates jump scares");
      expect(both?.pinned).toBe("- I will never watch a musical");
      expect(typeof both?.updatedAt).toBe("string");

      // The rewrite job replaces the prose and must not lose the pinned block.
      await store.setMemory("u1", { markdown: "- rewritten" });
      expect(await store.getMemory("u1")).toMatchObject({ markdown: "- rewritten", pinned: "- I will never watch a musical" });
      expect(await store.getMemory("u2")).toBeNull();
    });

    it("episodes come back newest first, filtered by limit, query and since", async () => {
      const store = await factory();
      await store.addEpisodes("u1", [
        { kind: "log", titleImdbId: "tt1", text: "liked Heat (1995)", at: "2026-09-01T00:00:00.000Z" },
        { kind: "chat", text: "said they cannot stand musicals", at: "2026-09-05T00:00:00.000Z" },
        { kind: "swipe", titleImdbId: "tt2", text: "never seen Cats (2019)", at: "2026-09-09T00:00:00.000Z" },
      ]);
      await store.addEpisodes("u2", [{ kind: "log", text: "liked something else", at: "2026-09-09T00:00:00.000Z" }]);

      const all = await store.listEpisodes("u1");
      expect(all.map((e) => e.text)).toEqual([
        "never seen Cats (2019)",
        "said they cannot stand musicals",
        "liked Heat (1995)",
      ]);
      expect(all[0]).toMatchObject({ kind: "swipe", titleImdbId: "tt2", at: "2026-09-09T00:00:00.000Z" });
      // A chat episode is not about one title.
      expect(all[1].titleImdbId).toBeNull();
      expect(all.every((e) => typeof e.id === "string" && e.id.length > 0)).toBe(true);

      expect((await store.listEpisodes("u1", { limit: 2 })).map((e) => e.text)).toEqual([
        "never seen Cats (2019)",
        "said they cannot stand musicals",
      ]);
      // Case-insensitive substring over the text only.
      expect((await store.listEpisodes("u1", { query: "MUSICALS" })).map((e) => e.text)).toEqual(["said they cannot stand musicals"]);
      expect(await store.listEpisodes("u1", { query: "nothing here" })).toEqual([]);
      expect((await store.listEpisodes("u1", { since: "2026-09-05T00:00:00.000Z" })).map((e) => e.text)).toEqual([
        "never seen Cats (2019)",
        "said they cannot stand musicals",
      ]);
      expect((await store.listEpisodes("u2")).map((e) => e.text)).toEqual(["liked something else"]);
      expect(await store.listEpisodes("nobody")).toEqual([]);
    });

    it("addEpisodes defaults `at` to the clock and stores the text verbatim", async () => {
      const store = await factory({ now: () => new Date("2026-09-11T10:00:00.000Z") });
      await store.addEpisodes("u1", [{ kind: "log", titleImdbId: "tt1", text: 'liked Heat (1995): "the diner scene, again"' }]);
      await store.addEpisodes("u1", []);
      expect(await store.listEpisodes("u1")).toMatchObject([
        { at: "2026-09-11T10:00:00.000Z", text: 'liked Heat (1995): "the diner scene, again"' },
      ]);
    });

    it("setProgress creates a series row as `seen` and then bumps only what it is given", async () => {
      const store = await factory();
      await store.setProgress("u1", "tt-series", { season: 2, episodesWatched: 3 });
      // "One more episode of X" is not a score: the new row is watched, no opinion.
      expect(await store.listWatched("u1")).toMatchObject([
        { titleImdbId: "tt-series", rating: "seen", score: null, source: "chat", season: 2, episodesWatched: 3 },
      ]);

      await store.setProgress("u1", "tt-series", { episodesWatched: 4 });
      expect(await store.listWatched("u1")).toMatchObject([{ season: 2, episodesWatched: 4 }]);

      await store.setProgress("u1", "tt-series", { season: 3 });
      expect(await store.listWatched("u1")).toMatchObject([{ season: 3, episodesWatched: 4 }]);
    });

    it("setProgress keeps an existing row's score and source", async () => {
      const store = await factory();
      await store.upsertWatched("u1", [{ titleImdbId: "tt-series", rating: "rated", score: 5, source: "letterboxd" }]);
      await store.setProgress("u1", "tt-series", { episodesWatched: 2 });
      expect(await store.listWatched("u1")).toMatchObject([
        { rating: "rated", score: 5, source: "letterboxd", episodesWatched: 2 },
      ]);
    });

    it("a rating that says nothing about episodes does not erase the counter", async () => {
      const store = await factory();
      await store.setProgress("u1", "tt-series", { episodesWatched: 6 });
      await store.upsertWatched("u1", [{ titleImdbId: "tt-series", rating: "rated", score: 8, source: "swipe" }]);
      expect(await store.listWatched("u1")).toMatchObject([{ rating: "rated", score: 8, episodesWatched: 6 }]);
    });

    it("services round-trip, default to US, and replace on write", async () => {
      const store = await factory();
      expect(await store.getServices("u1")).toBeNull();

      const first = await store.setServices("u1", { providerIds: [8, 1899] });
      expect(first).toMatchObject({ providerIds: [8, 1899], region: "US" });
      expect(await store.getServices("u1")).toMatchObject({ providerIds: [8, 1899], region: "US" });

      await store.setServices("u1", { providerIds: [15], region: "GB" });
      expect(await store.getServices("u1")).toMatchObject({ providerIds: [15], region: "GB" });
      expect(await store.getServices("u2")).toBeNull();
    });

    it("taste round-trips the vector and the derived facts, and allows a null vector", async () => {
      const store = await factory();
      expect(await store.getTaste("u1")).toBeNull();

      await store.setTaste("u1", { vector: vec(1, 0, 0.5), facts: FACTS });
      const stored = await store.getTaste("u1");
      expect(stored?.facts).toEqual(FACTS);
      expect(stored?.vector).toHaveLength(EMBEDDING_DIMS);
      expect(stored?.vector?.slice(0, 3)).toEqual([1, 0, 0.5]);

      await store.setTaste("u1", { vector: null, facts: EMPTY_TASTE_FACTS });
      const after = await store.getTaste("u1");
      expect(after?.vector).toBeNull();
      expect(after?.facts).toEqual(EMPTY_TASTE_FACTS);
    });

    it("deleteUser empties every per-user table for that user only", async () => {
      const store = await factory();
      for (const u of ["u1", "u2"]) {
        await store.upsertWatched(u, [{ titleImdbId: "tt1", rating: "rated", score: 8, source: "swipe" }]);
        await store.setServices(u, { providerIds: [8] });
        await store.setTaste(u, { vector: vec(1), facts: FACTS });
        await store.setMemory(u, { markdown: "- something", pinned: "- pinned" });
        await store.addEpisodes(u, [{ kind: "log", text: "liked Heat (1995)" }]);
      }

      await store.deleteUser("u1");
      expect(await store.listWatched("u1")).toEqual([]);
      expect(await store.getServices("u1")).toBeNull();
      expect(await store.getTaste("u1")).toBeNull();
      expect(await store.getMemory("u1")).toBeNull();
      expect(await store.listEpisodes("u1")).toEqual([]);

      expect(await store.listWatched("u2")).toHaveLength(1);
      expect(await store.getServices("u2")).not.toBeNull();
      expect(await store.getTaste("u2")).not.toBeNull();
      expect(await store.getMemory("u2")).not.toBeNull();
      expect(await store.listEpisodes("u2")).toHaveLength(1);
    });

    it("tonight round-trips a stored result, replaces on write, and is gone after deleteUser", async () => {
      const store = await factory();
      expect(await store.getTonight("u1")).toBeNull();
      await store.setTonight("u1", { picks: [{ imdbId: "tt0000002" }], deck: [] });
      const first = await store.getTonight("u1");
      expect(first?.data).toEqual({ picks: [{ imdbId: "tt0000002" }], deck: [] });
      expect(typeof first?.generatedAt).toBe("string");
      await store.setTonight("u1", { picks: [], deck: ["tt0000001"] });
      expect((await store.getTonight("u1"))?.data).toEqual({ picks: [], deck: ["tt0000001"] });
      expect(await store.getTonight("u2")).toBeNull();
      await store.deleteUser("u1");
      expect(await store.getTonight("u1")).toBeNull();
    });

    it("activeUsers lists users with recent watched or services activity", async () => {
      let clock = new Date("2026-09-01T00:00:00.000Z");
      const store = await factory({ now: () => clock });
      await store.upsertWatched("old", [{ titleImdbId: "tt0000001", rating: "rated", score: 8, source: "swipe" }]);
      clock = new Date("2026-09-10T00:00:00.000Z");
      await store.setServices("fresh-services", { providerIds: [8] });
      await store.upsertWatched("fresh-watched", [{ titleImdbId: "tt0000002", rating: "rated", score: 5, source: "chat" }]);
      expect(await store.activeUsers(new Date("2026-09-05T00:00:00.000Z"))).toEqual(["fresh-services", "fresh-watched"]);
      expect(await store.activeUsers(new Date("2026-08-01T00:00:00.000Z"))).toEqual(["fresh-services", "fresh-watched", "old"]);
    });

    it("a score round-trips, and a re-rate replaces it", async () => {
      const store = await factory();
      await store.upsertWatched("u1", [
        { titleImdbId: "tt-10", rating: "rated", score: 10, source: "log" },
        { titleImdbId: "tt-1", rating: "rated", score: 1, source: "log" },
      ]);
      expect(await store.listWatched("u1")).toMatchObject([
        { titleImdbId: "tt-1", score: 1 },
        { titleImdbId: "tt-10", score: 10 },
      ]);

      await store.upsertWatched("u1", [{ titleImdbId: "tt-10", rating: "rated", score: 6, source: "log" }]);
      expect((await store.listWatched("u1")).find((r) => r.titleImdbId === "tt-10")).toMatchObject({ rating: "rated", score: 6 });

      // A state with no opinion carries no score, and dropping the score is
      // how "actually I have not rated it" is written.
      await store.upsertWatched("u1", [{ titleImdbId: "tt-10", rating: "want", source: "log" }]);
      expect((await store.listWatched("u1")).find((r) => r.titleImdbId === "tt-10")).toMatchObject({ rating: "want", score: null });
    });

    it("upsertWatched rejects a score that does not match the state", async () => {
      const store = await factory();
      await expect(store.upsertWatched("u1", [{ titleImdbId: "tt1", rating: "rated", source: "log" }])).rejects.toThrow(/score/);
      await expect(store.upsertWatched("u1", [{ titleImdbId: "tt1", rating: "rated", score: null, source: "log" }])).rejects.toThrow(/score/);
      await expect(store.upsertWatched("u1", [{ titleImdbId: "tt1", rating: "rated", score: 0, source: "log" }])).rejects.toThrow(/score/);
      await expect(store.upsertWatched("u1", [{ titleImdbId: "tt1", rating: "rated", score: 11, source: "log" }])).rejects.toThrow(/score/);
      await expect(store.upsertWatched("u1", [{ titleImdbId: "tt1", rating: "rated", score: 7.5, source: "log" }])).rejects.toThrow(/score/);
      await expect(store.upsertWatched("u1", [{ titleImdbId: "tt1", rating: "want", score: 8, source: "log" }])).rejects.toThrow(/score/);
      await expect(store.upsertWatched("u1", [{ titleImdbId: "tt1", rating: "seen", score: 3, source: "log" }])).rejects.toThrow(/score/);
      expect(await store.listWatched("u1")).toEqual([]);
    });

    it("the injected clock stamps updatedAt", async () => {
      const store = await factory({ now: () => new Date("2026-09-11T10:00:00.000Z") });
      await store.upsertWatched("u1", [{ titleImdbId: "tt1", rating: "rated", score: 8, source: "swipe" }]);
      const services = await store.setServices("u1", { providerIds: [8] });
      const taste = await store.setTaste("u1", { vector: null, facts: EMPTY_TASTE_FACTS });

      expect((await store.listWatched("u1"))[0].updatedAt).toBe("2026-09-11T10:00:00.000Z");
      expect(services.updatedAt).toBe("2026-09-11T10:00:00.000Z");
      expect(taste.updatedAt).toBe("2026-09-11T10:00:00.000Z");
    });
  });
}

describeStore("MemoryTasteStore", async (opts = {}) => new MemoryTasteStore(opts));

describeStore("PostgresTasteStore", async (opts = {}) => {
  await truncate();
  return new PostgresTasteStore(db, opts);
});

// ---- the titles cache -----------------------------------------------------

const HEAT: TitleRow = {
  imdbId: "tt0113277",
  tmdbId: 949,
  kind: "movie",
  name: "Heat",
  year: 1995,
  runtime: 170,
  seasons: null,
  genres: ["Action", "Crime"],
  posterPath: "/heat.jpg",
  providers: { link: "https://www.themoviedb.org/movie/949/watch", flatrate: [{ id: 8, name: "Netflix" }] },
  fetchedAt: "2026-09-11T10:00:00.000Z",
};

const SHOW: TitleRow = {
  imdbId: "tt0141842",
  tmdbId: 1398,
  kind: "series",
  name: "The Sopranos",
  year: 1999,
  runtime: 55,
  seasons: [
    { season: 1, episodes: 13 },
    { season: 2, episodes: 13 },
  ],
  genres: ["Drama"],
  posterPath: null,
  providers: null,
  fetchedAt: null,
};

function describeTitles(name: string, factory: () => Promise<TitlesStore>) {
  describe(name, () => {
    it("upserts, reads back whole rows, and reports misses by absence", async () => {
      const store = await factory();
      expect(await store.getMany(["tt0113277"])).toEqual(new Map());
      expect(await store.getMany([])).toEqual(new Map());

      await store.upsertMany([HEAT, SHOW]);
      const got = await store.getMany(["tt0113277", "tt0141842", "tt-missing"]);
      expect(got.size).toBe(2);
      expect(got.get("tt0113277")).toEqual(HEAT);
      // Seasons and a null fetchedAt (the TMDB-failure case) survive the trip.
      expect(got.get("tt0141842")).toEqual(SHOW);
    });

    it("an upsert replaces the row it hits", async () => {
      const store = await factory();
      await store.upsertMany([HEAT]);
      await store.upsertMany([{ ...HEAT, runtime: 171, providers: null, fetchedAt: "2026-09-12T00:00:00.000Z" }]);
      expect((await store.getMany(["tt0113277"])).get("tt0113277")).toMatchObject({
        runtime: 171,
        providers: null,
        fetchedAt: "2026-09-12T00:00:00.000Z",
      });
      await store.upsertMany([]);
    });

    it("the last row wins when one call mentions an id twice", async () => {
      const store = await factory();
      await store.upsertMany([HEAT, { ...HEAT, name: "Heat (1995)" }]);
      expect((await store.getMany(["tt0113277"])).get("tt0113277")?.name).toBe("Heat (1995)");
    });
  });
}

describeTitles("MemoryTitlesStore", async () => new MemoryTitlesStore());

describeTitles("PostgresTitlesStore", async () => {
  await truncate();
  return new PostgresTitlesStore(db);
});
