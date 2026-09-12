import { and, asc, desc, eq, gte, ilike, inArray, sql } from "drizzle-orm";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import type { BrainDatabase } from "@/lib/brain/postgres";
import { crawls, episodes, memory, services, taste, watched } from "@/lib/brain/schema";
import {
  type CrawlResultInput,
  type CrawlRow,
  type CrawlSource,
  type EpisodeInput,
  type EpisodeKind,
  type EpisodeRow,
  type ImportSource,
  type MemoryInput,
  type MemoryRow,
  type ProgressInput,
  type ServicesInput,
  type ServicesRow,
  type TasteInput,
  type TasteRow,
  type TasteStore,
  type WatchedInput,
  type WatchedRow,
} from "./types";
import { validateScore } from "./score";

type WatchedDbRow = typeof watched.$inferSelect;

type CrawlDbRow = typeof crawls.$inferSelect;

function toCrawlRow(row: CrawlDbRow): CrawlRow {
  return {
    source: row.source,
    username: row.username,
    status: row.status,
    imported: row.imported,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    error: row.error,
  };
}

/** Monotonic within the process; part of the sortable episode id. */
let episodeSeq = 0;

/** ILIKE treats % and _ as wildcards; a user's search text is literal. */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function toWatchedRow(row: WatchedDbRow): WatchedRow {
  return {
    titleImdbId: row.titleImdbId,
    rating: row.rating,
    score: row.score,
    watchedAt: row.watchedAt ? row.watchedAt.toISOString() : null,
    source: row.source,
    season: row.season,
    episodesWatched: row.episodesWatched,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The taste store on Postgres (Neon in production, PGlite in tests). Semantics
 * match `MemoryTasteStore` exactly; one conformance suite runs over both.
 */
export class PostgresTasteStore implements TasteStore {
  private db: BrainDatabase;
  private now: () => Date;

  /**
   * @param source a Postgres connection string (Neon over HTTP) or an
   *   already-constructed drizzle database (tests: PGlite).
   */
  constructor(source: string | BrainDatabase, opts: { now?: () => Date } = {}) {
    this.db = typeof source === "string" ? neonDrizzle(source) : source;
    this.now = opts.now ?? (() => new Date());
  }

  /**
   * Sortable episode id: the clock in base 36 plus a per-process counter, so
   * `(at desc, id desc)` reproduces insertion order for rows written in the
   * same millisecond. The memory store pads its counter for the same reason.
   */
  private episodeId(): string {
    return `${Date.now().toString(36).padStart(9, "0")}-${String(++episodeSeq).padStart(9, "0")}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async upsertWatched(userId: string, rows: WatchedInput[]): Promise<void> {
    if (rows.length === 0) return;
    const at = this.now();
    // Postgres refuses an ON CONFLICT that hits the same row twice in one
    // statement, so the last row for a title wins before we send it.
    const byId = new Map<string, WatchedInput>();
    for (const row of rows) byId.set(row.titleImdbId, row);
    await this.db
      .insert(watched)
      .values(
        [...byId.values()].map((row) => ({
          userId,
          titleImdbId: row.titleImdbId,
          rating: row.rating,
          score: validateScore(row),
          watchedAt: row.watchedAt ? new Date(row.watchedAt) : null,
          source: row.source,
          season: row.season ?? null,
          episodesWatched: row.episodesWatched ?? 0,
          updatedAt: at,
        })),
      )
      .onConflictDoUpdate({
        target: [watched.userId, watched.titleImdbId],
        set: {
          rating: sql`excluded.rating`,
          score: sql`excluded.score`,
          watchedAt: sql`excluded.watched_at`,
          source: sql`excluded.source`,
          season: sql`excluded.season`,
          // An upsert that says nothing about episodes keeps the counter: a
          // swipe or a chat rating must not erase "one more episode" progress.
          episodesWatched: sql`case when excluded.episodes_watched = 0 then ${watched.episodesWatched} else excluded.episodes_watched end`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async listWatched(userId: string): Promise<WatchedRow[]> {
    const rows = await this.db
      .select()
      .from(watched)
      .where(eq(watched.userId, userId))
      .orderBy(asc(watched.titleImdbId));
    return rows.map(toWatchedRow);
  }

  async deleteWatched(userId: string, titleImdbId: string): Promise<void> {
    await this.db
      .delete(watched)
      .where(and(eq(watched.userId, userId), eq(watched.titleImdbId, titleImdbId)));
  }

  async replaceImport(userId: string, source: ImportSource, rows: WatchedInput[]): Promise<void> {
    await this.db.delete(watched).where(and(eq(watched.userId, userId), eq(watched.source, source)));
    await this.upsertWatched(
      userId,
      rows.map((r) => ({ ...r, source })),
    );
  }

  async getMemory(userId: string): Promise<MemoryRow | null> {
    const [row] = await this.db.select().from(memory).where(eq(memory.userId, userId)).limit(1);
    if (!row) return null;
    return { markdown: row.markdown, pinned: row.pinned, dropped: row.dropped ?? [], rowsHash: row.rowsHash ?? "", updatedAt: row.updatedAt.toISOString() };
  }

  async setMemory(userId: string, input: MemoryInput): Promise<void> {
    const at = this.now();
    await this.db
      .insert(memory)
      .values({ userId, markdown: input.markdown ?? "", pinned: input.pinned ?? "", dropped: input.dropped ?? [], rowsHash: input.rowsHash ?? "", updatedAt: at })
      .onConflictDoUpdate({
        target: memory.userId,
        set: {
          // A partial update keeps the field the caller said nothing about:
          // the rewrite job never touches `pinned`, and an Edit never drops
          // the prose it was not shown.
          ...(input.markdown === undefined ? {} : { markdown: sql`excluded.markdown` }),
          ...(input.pinned === undefined ? {} : { pinned: sql`excluded.pinned` }),
          ...(input.dropped === undefined ? {} : { dropped: sql`excluded.dropped` }),
          ...(input.rowsHash === undefined ? {} : { rowsHash: sql`excluded.rows_hash` }),
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async addEpisodes(userId: string, rows: EpisodeInput[]): Promise<void> {
    if (rows.length === 0) return;
    const at = this.now();
    await this.db.insert(episodes).values(
      rows.map((row) => ({
        id: this.episodeId(),
        userId,
        at: row.at ? new Date(row.at) : at,
        kind: row.kind,
        titleImdbId: row.titleImdbId ?? null,
        text: row.text,
      })),
    );
  }

  async deleteEpisodes(userId: string, opts: { titleImdbId?: string; kinds?: EpisodeKind[] } = {}): Promise<void> {
    const where = [eq(episodes.userId, userId)];
    if (opts.titleImdbId !== undefined) where.push(eq(episodes.titleImdbId, opts.titleImdbId));
    if (opts.kinds) {
      if (opts.kinds.length === 0) return;
      where.push(inArray(episodes.kind, opts.kinds));
    }
    await this.db.delete(episodes).where(and(...where));
  }

  async listEpisodes(userId: string, opts: { limit?: number; since?: string; query?: string } = {}): Promise<EpisodeRow[]> {
    const where = [eq(episodes.userId, userId)];
    if (opts.since) where.push(gte(episodes.at, new Date(opts.since)));
    if (opts.query) where.push(ilike(episodes.text, `%${escapeLike(opts.query)}%`));
    let q = this.db
      .select()
      .from(episodes)
      .where(and(...where))
      .orderBy(desc(episodes.at), desc(episodes.id))
      .$dynamic();
    if (opts.limit !== undefined) q = q.limit(opts.limit);
    const rows = await q;
    return rows.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      kind: r.kind,
      titleImdbId: r.titleImdbId,
      text: r.text,
    }));
  }

  async setServices(userId: string, input: ServicesInput): Promise<ServicesRow> {
    const at = this.now();
    const providerIds = [...input.providerIds];
    const region = input.region ?? "US";
    await this.db
      .insert(services)
      .values({ userId, providerIds, region, updatedAt: at })
      .onConflictDoUpdate({
        target: services.userId,
        set: {
          providerIds: sql`excluded.provider_ids`,
          region: sql`excluded.region`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
    return { providerIds, region, updatedAt: at.toISOString() };
  }

  async getServices(userId: string): Promise<ServicesRow | null> {
    const [row] = await this.db.select().from(services).where(eq(services.userId, userId)).limit(1);
    if (!row) return null;
    return { providerIds: row.providerIds, region: row.region, updatedAt: row.updatedAt.toISOString() };
  }

  async setTaste(userId: string, input: TasteInput): Promise<TasteRow> {
    const at = this.now();
    const vector = input.vector ? [...input.vector] : null;
    await this.db
      .insert(taste)
      .values({ userId, vector, facts: input.facts, updatedAt: at })
      .onConflictDoUpdate({
        target: taste.userId,
        set: {
          vector: sql`excluded.vector`,
          facts: sql`excluded.facts`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
    return { vector, facts: input.facts, updatedAt: at.toISOString() };
  }

  async getTaste(userId: string): Promise<TasteRow | null> {
    const [row] = await this.db.select().from(taste).where(eq(taste.userId, userId)).limit(1);
    if (!row) return null;
    return { vector: row.vector ?? null, facts: row.facts, updatedAt: row.updatedAt.toISOString() };
  }

  async setProgress(userId: string, titleImdbId: string, progress: ProgressInput): Promise<void> {
    const at = this.now();
    await this.db
      .insert(watched)
      .values({
        userId,
        titleImdbId,
        // "One more episode of X" says they are watching it, not what they
        // think of it, so a series the store has not seen before starts as
        // `seen` (watched, no opinion) with no score invented for them.
        rating: "seen",
        score: null,
        watchedAt: null,
        source: "chat",
        season: progress.season ?? null,
        episodesWatched: progress.episodesWatched ?? 0,
        updatedAt: at,
      })
      .onConflictDoUpdate({
        target: [watched.userId, watched.titleImdbId],
        set: {
          ...(progress.season === undefined ? {} : { season: sql`excluded.season` }),
          ...(progress.episodesWatched === undefined
            ? {}
            : { episodesWatched: sql`excluded.episodes_watched` }),
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async getCrawl(userId: string, source: CrawlSource): Promise<CrawlRow | null> {
    const [row] = await this.db
      .select()
      .from(crawls)
      .where(and(eq(crawls.userId, userId), eq(crawls.source, source)))
      .limit(1);
    return row ? toCrawlRow(row) : null;
  }

  async startCrawl(userId: string, source: CrawlSource, username: string): Promise<CrawlRow> {
    const at = this.now();
    const [row] = await this.db
      .insert(crawls)
      .values({ userId, source, username, status: "running", imported: 0, startedAt: at, finishedAt: null, error: null })
      .onConflictDoUpdate({
        target: [crawls.userId, crawls.source],
        set: {
          username: sql`excluded.username`,
          status: sql`excluded.status`,
          imported: sql`excluded.imported`,
          startedAt: sql`excluded.started_at`,
          finishedAt: sql`excluded.finished_at`,
          error: sql`excluded.error`,
        },
      })
      .returning();
    return toCrawlRow(row);
  }

  async finishCrawl(userId: string, source: CrawlSource, result: CrawlResultInput): Promise<CrawlRow> {
    const at = this.now();
    const [row] = await this.db
      .insert(crawls)
      .values({
        userId,
        source,
        username: result.username ?? "",
        status: result.status,
        imported: result.imported ?? 0,
        startedAt: at,
        finishedAt: at,
        error: result.error ?? null,
      })
      .onConflictDoUpdate({
        target: [crawls.userId, crawls.source],
        set: {
          // A finish keeps the username the run started with unless the caller
          // names one: the row is about that crawl, not about a later request.
          ...(result.username === undefined ? {} : { username: sql`excluded.username` }),
          status: sql`excluded.status`,
          imported: sql`excluded.imported`,
          finishedAt: sql`excluded.finished_at`,
          error: sql`excluded.error`,
        },
      })
      .returning();
    return toCrawlRow(row);
  }

  async activeUsers(since: Date): Promise<string[]> {
    const [a, b] = await Promise.all([
      this.db.selectDistinct({ userId: watched.userId }).from(watched).where(gte(watched.updatedAt, since)),
      this.db.selectDistinct({ userId: services.userId }).from(services).where(gte(services.updatedAt, since)),
    ]);
    return [...new Set([...a, ...b].map((r) => r.userId))].sort();
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete(crawls).where(eq(crawls.userId, userId));
    await this.db.delete(watched).where(eq(watched.userId, userId));
    await this.db.delete(services).where(eq(services.userId, userId));
    await this.db.delete(taste).where(eq(taste.userId, userId));
    await this.db.delete(memory).where(eq(memory.userId, userId));
    await this.db.delete(episodes).where(eq(episodes.userId, userId));
  }
}
