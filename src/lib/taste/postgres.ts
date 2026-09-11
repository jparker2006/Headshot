import { and, asc, desc, eq, gte, ilike, sql } from "drizzle-orm";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import type { BrainDatabase } from "@/lib/brain/postgres";
import { episodes, memory, services, taste, tonight, watched } from "@/lib/brain/schema";
import {
  type EpisodeInput,
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

type WatchedDbRow = typeof watched.$inferSelect;

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
    return { markdown: row.markdown, pinned: row.pinned, updatedAt: row.updatedAt.toISOString() };
  }

  async setMemory(userId: string, input: MemoryInput): Promise<void> {
    const at = this.now();
    await this.db
      .insert(memory)
      .values({ userId, markdown: input.markdown ?? "", pinned: input.pinned ?? "", updatedAt: at })
      .onConflictDoUpdate({
        target: memory.userId,
        set: {
          // A partial update keeps the field the caller said nothing about:
          // the rewrite job never touches `pinned`, and an Edit never drops
          // the prose it was not shown.
          ...(input.markdown === undefined ? {} : { markdown: sql`excluded.markdown` }),
          ...(input.pinned === undefined ? {} : { pinned: sql`excluded.pinned` }),
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
        // "One more episode of X" is an explicit positive tap, so a series the
        // store has not seen before starts as liked rather than as a guess.
        rating: "liked",
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

  async setTonight(userId: string, data: Record<string, unknown>): Promise<void> {
    const at = this.now();
    await this.db
      .insert(tonight)
      .values({ userId, data, generatedAt: at })
      .onConflictDoUpdate({ target: tonight.userId, set: { data: sql`excluded.data`, generatedAt: sql`excluded.generated_at` } });
  }

  async getTonight(userId: string): Promise<{ data: Record<string, unknown>; generatedAt: string } | null> {
    const [row] = await this.db.select().from(tonight).where(eq(tonight.userId, userId)).limit(1);
    return row ? { data: row.data, generatedAt: row.generatedAt.toISOString() } : null;
  }

  async activeUsers(since: Date): Promise<string[]> {
    const [a, b] = await Promise.all([
      this.db.selectDistinct({ userId: watched.userId }).from(watched).where(gte(watched.updatedAt, since)),
      this.db.selectDistinct({ userId: services.userId }).from(services).where(gte(services.updatedAt, since)),
    ]);
    return [...new Set([...a, ...b].map((r) => r.userId))].sort();
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete(tonight).where(eq(tonight.userId, userId));
    await this.db.delete(watched).where(eq(watched.userId, userId));
    await this.db.delete(services).where(eq(services.userId, userId));
    await this.db.delete(taste).where(eq(taste.userId, userId));
    await this.db.delete(memory).where(eq(memory.userId, userId));
    await this.db.delete(episodes).where(eq(episodes.userId, userId));
  }
}
