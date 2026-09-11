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
    sql`truncate table "page_revisions", "pages", "nodes", "overlay_edges", "questions", "embeddings", "answers", "watched", "services", "taste", "tonight"`,
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
        { titleImdbId: "tt2", rating: "liked", source: "letterboxd", watchedAt: "2024-01-05T00:00:00.000Z" },
        { titleImdbId: "tt1", rating: "want", source: "swipe" },
      ]);
      await store.upsertWatched("u2", [{ titleImdbId: "tt1", rating: "meh", source: "chat" }]);
      await store.upsertWatched("u1", [{ titleImdbId: "tt1", rating: "liked", source: "swipe" }]);

      const rows = await store.listWatched("u1");
      // Ordered by title id so the list is stable between reads.
      expect(rows.map((r) => r.titleImdbId)).toEqual(["tt1", "tt2"]);
      expect(rows[0]).toMatchObject({ rating: "liked", source: "swipe", watchedAt: null, season: null, episodesWatched: 0 });
      expect(rows[1]).toMatchObject({ rating: "liked", source: "letterboxd", watchedAt: "2024-01-05T00:00:00.000Z" });
      expect(rows.every((r) => typeof r.updatedAt === "string")).toBe(true);

      expect(await store.listWatched("u2")).toMatchObject([{ titleImdbId: "tt1", rating: "meh", source: "chat" }]);
      expect(await store.listWatched("nobody")).toEqual([]);
    });

    it("the last row wins when one call mentions a title twice", async () => {
      const store = await factory();
      await store.upsertWatched("u1", [
        { titleImdbId: "tt1", rating: "meh", source: "swipe" },
        { titleImdbId: "tt1", rating: "liked", source: "swipe" },
      ]);
      expect(await store.listWatched("u1")).toMatchObject([{ titleImdbId: "tt1", rating: "liked" }]);
    });

    it("deleteWatched removes one row for one user", async () => {
      const store = await factory();
      await store.upsertWatched("u1", [
        { titleImdbId: "tt1", rating: "liked", source: "swipe" },
        { titleImdbId: "tt2", rating: "meh", source: "swipe" },
      ]);
      await store.upsertWatched("u2", [{ titleImdbId: "tt1", rating: "liked", source: "swipe" }]);
      await store.deleteWatched("u1", "tt1");

      expect((await store.listWatched("u1")).map((r) => r.titleImdbId)).toEqual(["tt2"]);
      expect((await store.listWatched("u2")).map((r) => r.titleImdbId)).toEqual(["tt1"]);
    });

    it("replaceImport drops only the previous letterboxd rows", async () => {
      const store = await factory();
      await store.upsertWatched("u1", [
        { titleImdbId: "tt-swipe", rating: "liked", source: "swipe" },
        { titleImdbId: "tt-chat", rating: "want", source: "chat" },
      ]);
      await store.replaceImport("u1", [
        { titleImdbId: "tt-a", rating: "liked", source: "letterboxd" },
        { titleImdbId: "tt-b", rating: "meh", source: "letterboxd" },
      ]);
      await store.replaceImport("u1", [{ titleImdbId: "tt-a", rating: "meh", source: "letterboxd" }]);

      const rows = await store.listWatched("u1");
      expect(rows.map((r) => r.titleImdbId)).toEqual(["tt-a", "tt-chat", "tt-swipe"]);
      expect(rows.find((r) => r.titleImdbId === "tt-a")).toMatchObject({ rating: "meh", source: "letterboxd" });
    });

    it("replaceImport stamps the source even when the caller forgot", async () => {
      const store = await factory();
      await store.replaceImport("u1", [{ titleImdbId: "tt-a", rating: "liked", source: "swipe" }]);
      expect(await store.listWatched("u1")).toMatchObject([{ source: "letterboxd" }]);
    });

    it("setProgress creates a series row and then bumps only what it is given", async () => {
      const store = await factory();
      await store.setProgress("u1", "tt-series", { season: 2, episodesWatched: 3 });
      expect(await store.listWatched("u1")).toMatchObject([
        { titleImdbId: "tt-series", rating: "liked", source: "chat", season: 2, episodesWatched: 3 },
      ]);

      await store.setProgress("u1", "tt-series", { episodesWatched: 4 });
      expect(await store.listWatched("u1")).toMatchObject([{ season: 2, episodesWatched: 4 }]);

      await store.setProgress("u1", "tt-series", { season: 3 });
      expect(await store.listWatched("u1")).toMatchObject([{ season: 3, episodesWatched: 4 }]);
    });

    it("setProgress keeps an existing row's rating and source", async () => {
      const store = await factory();
      await store.upsertWatched("u1", [{ titleImdbId: "tt-series", rating: "meh", source: "letterboxd" }]);
      await store.setProgress("u1", "tt-series", { episodesWatched: 2 });
      expect(await store.listWatched("u1")).toMatchObject([
        { rating: "meh", source: "letterboxd", episodesWatched: 2 },
      ]);
    });

    it("a rating that says nothing about episodes does not erase the counter", async () => {
      const store = await factory();
      await store.setProgress("u1", "tt-series", { episodesWatched: 6 });
      await store.upsertWatched("u1", [{ titleImdbId: "tt-series", rating: "liked", source: "swipe" }]);
      expect(await store.listWatched("u1")).toMatchObject([{ rating: "liked", episodesWatched: 6 }]);
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

    it("deleteUser empties all three tables for that user only", async () => {
      const store = await factory();
      for (const u of ["u1", "u2"]) {
        await store.upsertWatched(u, [{ titleImdbId: "tt1", rating: "liked", source: "swipe" }]);
        await store.setServices(u, { providerIds: [8] });
        await store.setTaste(u, { vector: vec(1), facts: FACTS });
      }

      await store.deleteUser("u1");
      expect(await store.listWatched("u1")).toEqual([]);
      expect(await store.getServices("u1")).toBeNull();
      expect(await store.getTaste("u1")).toBeNull();

      expect(await store.listWatched("u2")).toHaveLength(1);
      expect(await store.getServices("u2")).not.toBeNull();
      expect(await store.getTaste("u2")).not.toBeNull();
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
      await store.upsertWatched("old", [{ titleImdbId: "tt0000001", rating: "liked", source: "swipe" }]);
      clock = new Date("2026-09-10T00:00:00.000Z");
      await store.setServices("fresh-services", { providerIds: [8] });
      await store.upsertWatched("fresh-watched", [{ titleImdbId: "tt0000002", rating: "meh", source: "chat" }]);
      expect(await store.activeUsers(new Date("2026-09-05T00:00:00.000Z"))).toEqual(["fresh-services", "fresh-watched"]);
      expect(await store.activeUsers(new Date("2026-08-01T00:00:00.000Z"))).toEqual(["fresh-services", "fresh-watched", "old"]);
    });

    it("the injected clock stamps updatedAt", async () => {
      const store = await factory({ now: () => new Date("2026-09-11T10:00:00.000Z") });
      await store.upsertWatched("u1", [{ titleImdbId: "tt1", rating: "liked", source: "swipe" }]);
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
