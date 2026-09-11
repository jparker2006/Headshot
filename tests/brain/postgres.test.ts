import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import { MemoryBrain } from "@/lib/brain/memory";
import { PostgresBrain } from "@/lib/brain/postgres";
import { EMBEDDING_DIMS } from "@/lib/brain/schema";
import type { Brain, BrainNodeInput } from "@/lib/brain/types";

const MIGRATIONS = path.join(__dirname, "..", "..", "drizzle");

/** A brain factory: fresh, empty, with an optional injected clock. */
type BrainFactory = (opts?: { now?: () => Date }) => Promise<Brain>;

let client: PGlite;
let db: PgliteDatabase;

beforeAll(async () => {
  // PGlite loads pgvector as an extension module; the migration then runs
  // CREATE EXTENSION IF NOT EXISTS vector before the embeddings table.
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
    sql`truncate table "page_revisions", "pages", "nodes", "overlay_edges", "questions", "embeddings"`,
  );
}

function person(imdbId: string, name: string, extra: Partial<BrainNodeInput> = {}): BrainNodeInput {
  return {
    imdbId,
    name,
    kind: "person",
    titleType: "",
    year: 0,
    votes: 0,
    genres: "",
    inIndustryGraph: true,
    ...extra,
  };
}

function title(imdbId: string, name: string, extra: Partial<BrainNodeInput> = {}): BrainNodeInput {
  return {
    imdbId,
    name,
    kind: "title",
    titleType: "movie",
    year: 1997,
    votes: 5000,
    genres: "Drama",
    inIndustryGraph: true,
    ...extra,
  };
}

/** Every behavioural assertion both brains must satisfy. */
function describeBrain(name: string, factory: BrainFactory) {
  describe(name, () => {
    it("touchNodes is idempotent and keeps the first session's attribution", async () => {
      const brain = await factory();
      await brain.touchNodes([person("nm1", "Kevin Bacon")], "session-a");
      await brain.touchNodes([person("nm1", "Kevin Bacon (again)")], "session-b");
      await brain.touchNodes([person("nm1", "Kevin Bacon")], "session-b");

      const snap = await brain.snapshot();
      expect(snap.nodes).toHaveLength(1);
      expect(snap.nodes[0].name).toBe("Kevin Bacon");
      expect(await brain.sessionNodes("session-a")).toEqual(["nm1"]);
      expect(await brain.sessionNodes("session-b")).toEqual([]);
    });

    it("addEdges is idempotent", async () => {
      const brain = await factory();
      await brain.addEdges([{ personImdbId: "nm1", titleImdbId: "tt1", tier: 0 }]);
      await brain.addEdges([{ personImdbId: "nm1", titleImdbId: "tt1", tier: 0 }]);
      await brain.addEdges([{ personImdbId: "nm2", titleImdbId: "tt1", tier: 1 }]);

      const overlay = await brain.getOverlay();
      expect(overlay.edges).toHaveLength(2);
      expect([...overlay.edges].sort((a, b) => a.personImdbId.localeCompare(b.personImdbId))).toEqual([
        { personImdbId: "nm1", titleImdbId: "tt1", tier: 0 },
        { personImdbId: "nm2", titleImdbId: "tt1", tier: 1 },
      ]);
    });

    it("getOverlay excludes industry-graph nodes but includes overlay edges", async () => {
      const brain = await factory();
      await brain.touchNodes([
        person("nm1", "In The Packed Graph", { inIndustryGraph: true }),
        person("nm2", "Live Discovered", { inIndustryGraph: false }),
        title("tt1", "Some Indie", { inIndustryGraph: false }),
      ]);
      await brain.addEdges([{ personImdbId: "nm2", titleImdbId: "tt1", tier: 1 }]);

      const overlay = await brain.getOverlay();
      expect(overlay.nodes.map((n) => n.imdbId).sort()).toEqual(["nm2", "tt1"]);
      expect(overlay.nodes.find((n) => n.imdbId === "tt1")).toMatchObject({
        name: "Some Indie",
        kind: "title",
        titleType: "movie",
        year: 1997,
        votes: 5000,
        genres: "Drama",
      });
      expect(overlay.edges).toEqual([{ personImdbId: "nm2", titleImdbId: "tt1", tier: 1 }]);
    });

    it("writePage upserts the body and appends a revision carrying the question", async () => {
      const brain = await factory();
      expect(await brain.readPage("nm1")).toBeNull();

      const first = await brain.writePage({ imdbId: "nm1", body: "First draft.", question: "who?" });
      expect(first.body).toBe("First draft.");
      expect(first.revisions).toHaveLength(1);
      expect(first.revisions[0]).toMatchObject({ question: "who?", body: "First draft." });

      const second = await brain.writePage({
        imdbId: "nm1",
        body: "Revised.",
        question: "how connected?",
      });
      expect(second.body).toBe("Revised.");
      expect(second.revisions.map((r) => r.question)).toEqual(["who?", "how connected?"]);
      expect(second.revisions.map((r) => r.body)).toEqual(["First draft.", "Revised."]);

      const read = await brain.readPage("nm1");
      expect(read).toEqual(second);
    });

    it("snapshot returns every node and overlay edge", async () => {
      const brain = await factory();
      await brain.touchNodes([person("nm1", "A"), title("tt1", "T", { inIndustryGraph: false })]);
      await brain.addEdges([{ personImdbId: "nm1", titleImdbId: "tt1", tier: 0 }]);

      const snap = await brain.snapshot();
      expect(snap.nodes.map((n) => n.imdbId).sort()).toEqual(["nm1", "tt1"]);
      expect(snap.nodes.every((n) => typeof n.firstSeenAt === "string")).toBe(true);
      expect(snap.edges).toEqual([
        { personImdbId: "nm1", titleImdbId: "tt1", tier: 0, source: "overlay" },
      ]);
    });

    it("getNode and updateNode round-trip enrichment fields", async () => {
      const brain = await factory();
      await brain.touchNodes([person("nm1", "Kevin Bacon")]);
      await brain.updateNode("nm1", { tmdbId: 4724, posterUrl: "/kb.jpg", knownAs: "Footloose" });

      const node = await brain.getNode("nm1");
      expect(node).toMatchObject({
        imdbId: "nm1",
        name: "Kevin Bacon",
        kind: "person",
        inIndustryGraph: true,
        tmdbId: 4724,
        posterUrl: "/kb.jpg",
        knownAs: "Footloose",
      });
      expect(await brain.getNode("nm-missing")).toBeNull();
    });

    it("sessionNodes returns only the ids a session first added", async () => {
      const brain = await factory();
      await brain.touchNodes([person("nm1", "A"), person("nm2", "B")], "session-a");
      await brain.touchNodes([person("nm3", "C")], "session-b");
      await brain.touchNodes([person("nm4", "D")]);

      expect((await brain.sessionNodes("session-a")).sort()).toEqual(["nm1", "nm2"]);
      expect(await brain.sessionNodes("session-b")).toEqual(["nm3"]);
      expect(await brain.sessionNodes("session-unknown")).toEqual([]);
    });

    it("countQuestionsToday counts the current UTC day and resets across the boundary", async () => {
      let clock = new Date("2026-03-01T23:59:00.000Z");
      const brain = await factory({ now: () => clock });

      expect(await brain.countQuestionsToday()).toBe(0);
      await brain.recordQuestion({ text: "late one", sessionId: "s" });
      await brain.recordQuestion({ text: "later still" });
      expect(await brain.countQuestionsToday()).toBe(2);

      clock = new Date("2026-03-02T00:01:00.000Z");
      expect(await brain.countQuestionsToday()).toBe(0);
      await brain.recordQuestion({ text: "new day" });
      expect(await brain.countQuestionsToday()).toBe(1);

      clock = new Date("2026-03-01T12:00:00.000Z");
      expect(await brain.countQuestionsToday()).toBe(2);
    });
  });
}

describeBrain("MemoryBrain", async (opts = {}) => new MemoryBrain(opts));

describeBrain("PostgresBrain", async (opts = {}) => {
  await truncate();
  return new PostgresBrain(db, opts);
});

describe("PostgresBrain pgvector", () => {
  /** A unit-ish vector with the given leading components, zero-padded to the column width. */
  function vec(...leading: number[]): number[] {
    const v = new Array<number>(EMBEDDING_DIMS).fill(0);
    leading.forEach((x, i) => (v[i] = x));
    return v;
  }

  it("upsertEmbeddings inserts, is idempotent, and replaces an existing row", async () => {
    await truncate();
    const brain = new PostgresBrain(db);
    await brain.upsertEmbeddings([
      { imdbId: "nm1", embedding: vec(0, 1) },
      { imdbId: "nm2", embedding: vec(1, 0) },
    ]);
    await brain.upsertEmbeddings([{ imdbId: "nm1", embedding: vec(1, 0) }]);

    const hits = await brain.semanticSearch(vec(1, 0), 10);
    expect(hits).toHaveLength(2);
    // nm1 was replaced with nm2's direction, so both are now exact matches.
    expect(hits.every((h) => h.distance < 1e-6)).toBe(true);
  });

  it("semanticSearch orders by cosine distance and honours the limit", async () => {
    await truncate();
    const brain = new PostgresBrain(db);
    await brain.upsertEmbeddings([
      { imdbId: "far", embedding: vec(0, 1) },
      { imdbId: "near", embedding: vec(1, 0) },
      { imdbId: "middling", embedding: vec(1, 1) },
    ]);

    const hits = await brain.semanticSearch(vec(1, 0), 3);
    expect(hits.map((h) => h.imdbId)).toEqual(["near", "middling", "far"]);
    expect(hits[0].distance).toBeCloseTo(0, 5);
    expect(hits[1].distance).toBeCloseTo(1 - Math.SQRT1_2, 5);
    expect(hits[2].distance).toBeCloseTo(1, 5);

    expect((await brain.semanticSearch(vec(1, 0), 1)).map((h) => h.imdbId)).toEqual(["near"]);
    expect(await brain.semanticSearch(vec(1, 0), 0)).toEqual([]);
  });
});
