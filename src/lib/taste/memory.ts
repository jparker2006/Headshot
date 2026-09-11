import {
  EMPTY_TASTE_FACTS,
  type ProgressInput,
  type ServicesInput,
  type ServicesRow,
  type TasteInput,
  type TasteRow,
  type TasteStore,
  type WatchedInput,
  type WatchedRow,
} from "./types";

/**
 * The taste store in process memory. Used by keyless dev, by the route seam
 * tests, and as the reference implementation the Postgres store must match.
 * Nothing is persisted: this is per-user data and a dev file would leak it.
 */
export class MemoryTasteStore implements TasteStore {
  private watchedByUser = new Map<string, Map<string, WatchedRow>>();
  private servicesByUser = new Map<string, ServicesRow>();
  private tasteByUser = new Map<string, TasteRow>();
  private tonightByUser = new Map<string, { data: Record<string, unknown>; generatedAt: string }>();
  private now: () => Date;

  constructor(opts: { now?: () => Date } = {}) {
    this.now = opts.now ?? (() => new Date());
  }

  private stamp(): string {
    return this.now().toISOString();
  }

  private rows(userId: string): Map<string, WatchedRow> {
    let m = this.watchedByUser.get(userId);
    if (!m) this.watchedByUser.set(userId, (m = new Map()));
    return m;
  }

  async upsertWatched(userId: string, rows: WatchedInput[]): Promise<void> {
    const target = this.rows(userId);
    const at = this.stamp();
    for (const row of rows) {
      const prev = target.get(row.titleImdbId);
      target.set(row.titleImdbId, {
        titleImdbId: row.titleImdbId,
        rating: row.rating,
        watchedAt: row.watchedAt ?? null,
        source: row.source,
        season: row.season ?? null,
        // An upsert that says nothing about episodes keeps the counter: a
        // swipe or a chat rating must not erase "one more episode" progress.
        episodesWatched: (row.episodesWatched ?? 0) || prev?.episodesWatched || 0,
        updatedAt: at,
      });
    }
  }

  async listWatched(userId: string): Promise<WatchedRow[]> {
    return [...this.rows(userId).values()]
      .map((r) => ({ ...r }))
      .sort((a, b) => (a.titleImdbId < b.titleImdbId ? -1 : a.titleImdbId > b.titleImdbId ? 1 : 0));
  }

  async deleteWatched(userId: string, titleImdbId: string): Promise<void> {
    this.rows(userId).delete(titleImdbId);
  }

  async replaceImport(userId: string, rows: WatchedInput[]): Promise<void> {
    const target = this.rows(userId);
    for (const [id, row] of target) if (row.source === "letterboxd") target.delete(id);
    await this.upsertWatched(userId, rows.map((r) => ({ ...r, source: "letterboxd" as const })));
  }

  async setServices(userId: string, input: ServicesInput): Promise<ServicesRow> {
    const row: ServicesRow = {
      providerIds: [...input.providerIds],
      region: input.region ?? "US",
      updatedAt: this.stamp(),
    };
    this.servicesByUser.set(userId, row);
    return { ...row, providerIds: [...row.providerIds] };
  }

  async getServices(userId: string): Promise<ServicesRow | null> {
    const row = this.servicesByUser.get(userId);
    return row ? { ...row, providerIds: [...row.providerIds] } : null;
  }

  async setTaste(userId: string, input: TasteInput): Promise<TasteRow> {
    const row: TasteRow = {
      vector: input.vector ? [...input.vector] : null,
      facts: input.facts,
      updatedAt: this.stamp(),
    };
    this.tasteByUser.set(userId, row);
    return { ...row, vector: row.vector ? [...row.vector] : null };
  }

  async getTaste(userId: string): Promise<TasteRow | null> {
    const row = this.tasteByUser.get(userId);
    return row ? { ...row, vector: row.vector ? [...row.vector] : null } : null;
  }

  async setProgress(userId: string, titleImdbId: string, progress: ProgressInput): Promise<void> {
    const target = this.rows(userId);
    const prev = target.get(titleImdbId);
    target.set(titleImdbId, {
      titleImdbId,
      // "One more episode of X" is an explicit positive tap, so a series the
      // store has not seen before starts as liked rather than as a guess.
      rating: prev?.rating ?? "liked",
      watchedAt: prev?.watchedAt ?? null,
      source: prev?.source ?? "chat",
      season: progress.season ?? prev?.season ?? null,
      episodesWatched: progress.episodesWatched ?? prev?.episodesWatched ?? 0,
      updatedAt: this.stamp(),
    });
  }

  async setTonight(userId: string, data: Record<string, unknown>): Promise<void> {
    this.tonightByUser.set(userId, { data: structuredClone(data), generatedAt: this.stamp() });
  }

  async getTonight(userId: string): Promise<{ data: Record<string, unknown>; generatedAt: string } | null> {
    const row = this.tonightByUser.get(userId);
    return row ? { data: structuredClone(row.data), generatedAt: row.generatedAt } : null;
  }

  async activeUsers(since: Date): Promise<string[]> {
    const out = new Set<string>();
    for (const [userId, rows] of this.watchedByUser) if ([...rows.values()].some((r) => new Date(r.updatedAt) >= since)) out.add(userId);
    for (const [userId, row] of this.servicesByUser) if (new Date(row.updatedAt) >= since) out.add(userId);
    return [...out].sort();
  }

  async deleteUser(userId: string): Promise<void> {
    this.tonightByUser.delete(userId);
    this.watchedByUser.delete(userId);
    this.servicesByUser.delete(userId);
    this.tasteByUser.delete(userId);
  }
}

export { EMPTY_TASTE_FACTS };
