import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import type { BrainDatabase } from "@/lib/brain/postgres";
import { services, taste, tonight, watched } from "@/lib/brain/schema";
import {
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

  async replaceImport(userId: string, rows: WatchedInput[]): Promise<void> {
    await this.db
      .delete(watched)
      .where(and(eq(watched.userId, userId), eq(watched.source, "letterboxd")));
    await this.upsertWatched(
      userId,
      rows.map((r) => ({ ...r, source: "letterboxd" as const })),
    );
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

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete(tonight).where(eq(tonight.userId, userId));
    await this.db.delete(watched).where(eq(watched.userId, userId));
    await this.db.delete(services).where(eq(services.userId, userId));
    await this.db.delete(taste).where(eq(taste.userId, userId));
  }
}
