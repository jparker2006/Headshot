import { and, asc, cosineDistance, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Overlay, OverlayEdge } from "@/lib/graph/engine";
import { embeddings, nodes, overlayEdges, pageRevisions, pages, questions } from "./schema";
import type { Brain, BrainEdge, BrainNode, BrainNodeInput, BrainSnapshot, Page } from "./types";

/**
 * Any Postgres-dialect drizzle database. Neon's HTTP driver in production,
 * PGlite in tests. Queries below reference tables explicitly, so no relational
 * schema generic is needed.
 */
export type BrainDatabase = PgDatabase<PgQueryResultHKT>;

type NodeRow = typeof nodes.$inferSelect;

function toBrainNode(row: NodeRow): BrainNode {
  return {
    imdbId: row.imdbId,
    name: row.name,
    kind: row.kind,
    titleType: row.titleType,
    year: row.year,
    votes: row.votes,
    genres: row.genres,
    inIndustryGraph: row.inIndustryGraph,
    ...(row.tmdbId === null ? {} : { tmdbId: row.tmdbId }),
    ...(row.posterUrl === null ? {} : { posterUrl: row.posterUrl }),
    ...(row.knownAs === null ? {} : { knownAs: row.knownAs }),
    firstSeenAt: row.firstSeenAt.toISOString(),
  };
}

/** Start of the UTC day containing `at`. */
function utcDayStart(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

/**
 * The brain on Postgres (Neon + pgvector). Semantics match `MemoryBrain`
 * exactly; `tests/brain/postgres.test.ts` runs one conformance suite over both.
 */
export class PostgresBrain implements Brain {
  private db: BrainDatabase;
  private now: () => Date;

  /**
   * @param source a Postgres connection string (production: Neon over HTTP) or
   *   an already-constructed drizzle database (tests: PGlite).
   */
  constructor(source: string | BrainDatabase, opts: { now?: () => Date } = {}) {
    // Neon over HTTP. Node runtime only; never the edge runtime (see CLAUDE.md).
    this.db = typeof source === "string" ? neonDrizzle(source) : source;
    this.now = opts.now ?? (() => new Date());
  }

  async getOverlay(): Promise<Overlay> {
    const [nodeRows, edgeRows] = await Promise.all([
      this.db
        .select({
          imdbId: nodes.imdbId,
          name: nodes.name,
          kind: nodes.kind,
          titleType: nodes.titleType,
          year: nodes.year,
          votes: nodes.votes,
          genres: nodes.genres,
        })
        .from(nodes)
        .where(eq(nodes.inIndustryGraph, false)),
      this.db
        .select({
          personImdbId: overlayEdges.personImdbId,
          titleImdbId: overlayEdges.titleImdbId,
          tier: overlayEdges.tier,
        })
        .from(overlayEdges),
    ]);
    return { nodes: nodeRows, edges: edgeRows };
  }

  async touchNodes(input: BrainNodeInput[], sessionId?: string): Promise<void> {
    if (input.length === 0) return;
    const seen = new Set<string>();
    const values = [];
    for (const n of input) {
      if (seen.has(n.imdbId)) continue;
      seen.add(n.imdbId);
      values.push({
        imdbId: n.imdbId,
        name: n.name,
        kind: n.kind,
        titleType: n.titleType,
        year: n.year,
        votes: n.votes,
        genres: n.genres,
        inIndustryGraph: n.inIndustryGraph,
        tmdbId: n.tmdbId ?? null,
        posterUrl: n.posterUrl ?? null,
        knownAs: n.knownAs ?? null,
        firstSeenAt: n.firstSeenAt ? new Date(n.firstSeenAt) : this.now(),
        firstSessionId: sessionId ?? null,
      });
    }
    // Idempotent: the first writer wins, so first-seen attribution is stable.
    await this.db.insert(nodes).values(values).onConflictDoNothing();
  }

  async addEdges(edges: OverlayEdge[]): Promise<void> {
    if (edges.length === 0) return;
    const byKey = new Map<string, OverlayEdge>();
    for (const e of edges) byKey.set(`${e.personImdbId}|${e.titleImdbId}`, e);
    await this.db
      .insert(overlayEdges)
      .values([...byKey.values()])
      .onConflictDoUpdate({
        target: [overlayEdges.personImdbId, overlayEdges.titleImdbId],
        set: { tier: sql`excluded.tier` },
      });
  }

  async getNode(imdbId: string): Promise<BrainNode | null> {
    const [row] = await this.db.select().from(nodes).where(eq(nodes.imdbId, imdbId)).limit(1);
    return row ? toBrainNode(row) : null;
  }

  async updateNode(
    imdbId: string,
    patch: Partial<Pick<BrainNode, "tmdbId" | "posterUrl" | "knownAs">>,
  ): Promise<void> {
    const set: Partial<typeof nodes.$inferInsert> = {};
    if ("tmdbId" in patch) set.tmdbId = patch.tmdbId ?? null;
    if ("posterUrl" in patch) set.posterUrl = patch.posterUrl ?? null;
    if ("knownAs" in patch) set.knownAs = patch.knownAs ?? null;
    if (Object.keys(set).length === 0) return;
    await this.db.update(nodes).set(set).where(eq(nodes.imdbId, imdbId));
  }

  async readPage(imdbId: string): Promise<Page | null> {
    const [page] = await this.db.select().from(pages).where(eq(pages.imdbId, imdbId)).limit(1);
    if (!page) return null;
    const revisions = await this.db
      .select({ at: pageRevisions.at, question: pageRevisions.question, body: pageRevisions.body })
      .from(pageRevisions)
      .where(eq(pageRevisions.imdbId, imdbId))
      .orderBy(asc(pageRevisions.id));
    return {
      imdbId: page.imdbId,
      body: page.body,
      revisions: revisions.map((r) => ({ at: r.at.toISOString(), question: r.question, body: r.body })),
      updatedAt: page.updatedAt.toISOString(),
    };
  }

  async writePage({
    imdbId,
    body,
    question,
  }: {
    imdbId: string;
    body: string;
    question: string;
  }): Promise<Page> {
    const at = this.now();
    await this.db
      .insert(pages)
      .values({ imdbId, body, updatedAt: at })
      .onConflictDoUpdate({
        target: pages.imdbId,
        set: { body: sql`excluded.body`, updatedAt: sql`excluded.updated_at` },
      });
    await this.db.insert(pageRevisions).values({ imdbId, at, question, body });
    const page = await this.readPage(imdbId);
    if (!page) throw new Error(`writePage lost the page for ${imdbId}`);
    return page;
  }

  async snapshot(): Promise<BrainSnapshot> {
    const [nodeRows, edgeRows] = await Promise.all([
      this.db.select().from(nodes),
      this.db.select().from(overlayEdges),
    ]);
    const edges: BrainEdge[] = edgeRows.map((e) => ({
      personImdbId: e.personImdbId,
      titleImdbId: e.titleImdbId,
      tier: e.tier,
      source: "overlay",
    }));
    return { nodes: nodeRows.map(toBrainNode), edges };
  }

  async sessionNodes(sessionId: string): Promise<string[]> {
    const rows = await this.db
      .select({ imdbId: nodes.imdbId })
      .from(nodes)
      .where(and(isNotNull(nodes.firstSessionId), eq(nodes.firstSessionId, sessionId)));
    return rows.map((r) => r.imdbId);
  }

  async countQuestionsToday(): Promise<number> {
    const start = utcDayStart(this.now());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(questions)
      .where(and(gte(questions.at, start), lt(questions.at, end)));
    return row?.n ?? 0;
  }

  async recordQuestion(input: { sessionId?: string; text: string }): Promise<void> {
    await this.db
      .insert(questions)
      .values({ at: this.now(), sessionId: input.sessionId ?? null, text: input.text });
  }

  /** Store or replace embeddings for the top tier of entities. */
  async upsertEmbeddings(rows: { imdbId: string; embedding: number[] }[]): Promise<void> {
    if (rows.length === 0) return;
    const byId = new Map(rows.map((r) => [r.imdbId, r]));
    await this.db
      .insert(embeddings)
      .values([...byId.values()])
      .onConflictDoUpdate({
        target: embeddings.imdbId,
        set: { embedding: sql`excluded.embedding` },
      });
  }

  /** Nearest entities by pgvector cosine distance, closest first. */
  async semanticSearch(
    embedding: number[],
    limit: number,
  ): Promise<{ imdbId: string; distance: number }[]> {
    if (limit <= 0) return [];
    const distance = cosineDistance(embeddings.embedding, embedding);
    const rows = await this.db
      .select({ imdbId: embeddings.imdbId, distance: sql<number>`(${distance})::float8` })
      .from(embeddings)
      .orderBy(asc(distance))
      .limit(limit);
    return rows.map((r) => ({ imdbId: r.imdbId, distance: Number(r.distance) }));
  }
}
