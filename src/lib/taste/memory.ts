import {
  EMPTY_TASTE_FACTS,
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
import { validateScore } from "./score";

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
  private memoryByUser = new Map<string, MemoryRow>();
  private episodesByUser = new Map<string, EpisodeRow[]>();
  private episodeSeq = 0;
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
        score: validateScore(row),
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

  async replaceImport(userId: string, source: ImportSource, rows: WatchedInput[]): Promise<void> {
    const target = this.rows(userId);
    for (const [id, row] of target) if (row.source === source) target.delete(id);
    await this.upsertWatched(userId, rows.map((r) => ({ ...r, source })));
  }

  async getMemory(userId: string): Promise<MemoryRow | null> {
    const row = this.memoryByUser.get(userId);
    return row ? { ...row } : null;
  }

  async setMemory(userId: string, input: MemoryInput): Promise<void> {
    const prev = this.memoryByUser.get(userId);
    this.memoryByUser.set(userId, {
      markdown: input.markdown ?? prev?.markdown ?? "",
      pinned: input.pinned ?? prev?.pinned ?? "",
      updatedAt: this.stamp(),
    });
  }

  async addEpisodes(userId: string, rows: EpisodeInput[]): Promise<void> {
    if (rows.length === 0) return;
    let list = this.episodesByUser.get(userId);
    if (!list) this.episodesByUser.set(userId, (list = []));
    for (const row of rows) {
      list.push({
        // Zero-padded so (at desc, id desc) reproduces insertion order for
        // rows written in the same millisecond — the Postgres store sorts the
        // same way, so both implementations agree.
        id: `ep-${String(++this.episodeSeq).padStart(9, "0")}`,
        at: row.at ?? this.stamp(),
        kind: row.kind,
        titleImdbId: row.titleImdbId ?? null,
        text: row.text,
      });
    }
  }

  async listEpisodes(userId: string, opts: { limit?: number; since?: string; query?: string } = {}): Promise<EpisodeRow[]> {
    const q = opts.query?.toLowerCase();
    let rows = [...(this.episodesByUser.get(userId) ?? [])];
    if (opts.since) rows = rows.filter((r) => r.at >= opts.since!);
    if (q) rows = rows.filter((r) => r.text.toLowerCase().includes(q));
    // Newest first; ties break on the id, which grows with insertion.
    rows.sort((a, b) => (a.at === b.at ? (a.id < b.id ? 1 : -1) : a.at < b.at ? 1 : -1));
    return rows.slice(0, opts.limit ?? rows.length).map((r) => ({ ...r }));
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
      // "One more episode of X" says they are watching it, not what they think
      // of it, so a series the store has not seen before starts as `seen`
      // (watched, no opinion). Inventing a score would put a number in their
      // mouth, and v5 has no bucket left that could stand in for one.
      rating: prev?.rating ?? "seen",
      score: prev?.score ?? null,
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
    this.memoryByUser.delete(userId);
    this.episodesByUser.delete(userId);
  }
}

export { EMPTY_TASTE_FACTS };
