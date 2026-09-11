import { inArray, sql } from "drizzle-orm";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import type { BrainDatabase } from "@/lib/brain/postgres";
import { titles } from "@/lib/brain/schema";
import type { TitleRow, TitlesStore } from "./types";

function toRow(row: typeof titles.$inferSelect): TitleRow {
  return {
    imdbId: row.imdbId,
    tmdbId: row.tmdbId,
    kind: row.kind,
    name: row.name,
    year: row.year,
    runtime: row.runtime,
    seasons: row.seasons ?? null,
    genres: row.genres,
    posterPath: row.posterPath,
    providers: row.providers ?? null,
    fetchedAt: row.fetchedAt ? row.fetchedAt.toISOString() : null,
  };
}

/** The titles cache on Postgres. Semantics match `MemoryTitlesStore`. */
export class PostgresTitlesStore implements TitlesStore {
  private db: BrainDatabase;

  constructor(source: string | BrainDatabase) {
    this.db = typeof source === "string" ? neonDrizzle(source) : source;
  }

  async getMany(ids: string[]): Promise<Map<string, TitleRow>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db.select().from(titles).where(inArray(titles.imdbId, [...new Set(ids)]));
    return new Map(rows.map((r) => [r.imdbId, toRow(r)]));
  }

  async upsertMany(rows: TitleRow[]): Promise<void> {
    if (rows.length === 0) return;
    // Postgres refuses an ON CONFLICT that hits the same row twice in one
    // statement, so the last row for an id wins before we send it.
    const byId = new Map(rows.map((r) => [r.imdbId, r]));
    await this.db
      .insert(titles)
      .values(
        [...byId.values()].map((r) => ({
          imdbId: r.imdbId,
          tmdbId: r.tmdbId,
          kind: r.kind,
          name: r.name,
          year: r.year,
          runtime: r.runtime,
          seasons: r.seasons,
          genres: r.genres,
          posterPath: r.posterPath,
          providers: r.providers,
          fetchedAt: r.fetchedAt ? new Date(r.fetchedAt) : null,
        })),
      )
      .onConflictDoUpdate({
        target: titles.imdbId,
        set: {
          tmdbId: sql`excluded.tmdb_id`,
          kind: sql`excluded.kind`,
          name: sql`excluded.name`,
          year: sql`excluded.year`,
          runtime: sql`excluded.runtime`,
          seasons: sql`excluded.seasons`,
          genres: sql`excluded.genres`,
          posterPath: sql`excluded.poster_path`,
          providers: sql`excluded.providers`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });
  }
}
