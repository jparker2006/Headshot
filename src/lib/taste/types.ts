/**
 * The taste store: the private, per-user half of v3. Distinct from both the
 * read-only industry graph and the shared public brain — nothing in here is
 * ever rendered on the brain canvas or attached to a stored answer.
 *
 * Two implementations, one conformance suite (`tests/taste/store.test.ts`):
 * `MemoryTasteStore` for keyless dev and tests, `PostgresTasteStore` for Neon.
 */

/**
 * SPEC v3: four buckets, plus v4's neutral `seen` — watched, no opinion. A
 * Netflix import and a "just seen it" log land there rather than being called
 * liked, which would put words in the user's mouth.
 */
export type WatchedRating = "liked" | "meh" | "unseen" | "want" | "seen";

/** Where a row came from. Only explicit signals exist; nothing is inferred. */
export type WatchedSource = "letterboxd" | "swipe" | "chat" | "log" | "netflix" | "imdb";

/** The three CSV imports, each replaceable on its own (v4). */
export type ImportSource = Extract<WatchedSource, "letterboxd" | "netflix" | "imdb">;

/** What the evidence layer records: everything the user did or said. */
export type EpisodeKind = "log" | "swipe" | "chat" | "play";

export interface EpisodeRow {
  id: string;
  /** ISO timestamp. */
  at: string;
  kind: EpisodeKind;
  titleImdbId: string | null;
  text: string;
}

export interface EpisodeInput {
  kind: EpisodeKind;
  titleImdbId?: string | null;
  text: string;
  /** ISO timestamp; defaults to the store's clock. */
  at?: string;
}

/** The beliefs layer: prose the rewrite job owns plus lines the user pinned. */
export interface MemoryRow {
  markdown: string;
  pinned: string;
  updatedAt: string;
}

export interface MemoryInput {
  markdown?: string;
  pinned?: string;
}

export interface WatchedRow {
  titleImdbId: string;
  rating: WatchedRating;
  /** ISO timestamp, or null when the user never told us when. */
  watchedAt: string | null;
  source: WatchedSource;
  /** Series only: the season the user has marked. */
  season: number | null;
  /** Series only: the counter behind "one more episode of X". */
  episodesWatched: number;
  updatedAt: string;
}

/** What a caller supplies; the store fills in defaults and `updatedAt`. */
export interface WatchedInput {
  titleImdbId: string;
  rating: WatchedRating;
  source: WatchedSource;
  watchedAt?: string | null;
  season?: number | null;
  episodesWatched?: number;
}

export interface ServicesRow {
  /** TMDB watch-provider ids (see `src/lib/taste/providers.ts`). */
  providerIds: number[];
  region: string;
  updatedAt: string;
}

export interface ServicesInput {
  providerIds: number[];
  region?: string;
}

/** Derived nightly from the rated titles. Every field is explainable. */
export interface TasteFacts {
  /** Favourite people by count, most-watched first. */
  people: { imdbId: string; name: string; count: number }[];
  /** Decade label ("1990s") → count. */
  eras: Record<string, number>;
  avgRuntimeFinished: number | null;
  /** 0–1: share of finished things that were series. */
  tvShare: number | null;
  genresAvoided: string[];
}

export const EMPTY_TASTE_FACTS: TasteFacts = {
  people: [],
  eras: {},
  avgRuntimeFinished: null,
  tvShare: null,
  genresAvoided: [],
};

export interface TasteRow {
  /** The 512-dim taste vector, or null before the first nightly run. */
  vector: number[] | null;
  facts: TasteFacts;
  updatedAt: string;
}

export interface TasteInput {
  vector?: number[] | null;
  facts: TasteFacts;
}

/** Series progress from "one more episode of X". Both fields optional. */
export interface ProgressInput {
  season?: number;
  episodesWatched?: number;
}

export interface TasteStore {
  /** Insert or update rows, keyed by (user, title). Later rows win. */
  upsertWatched(userId: string, rows: WatchedInput[]): Promise<void>;
  /** Every row for a user, ordered by title id so tests and UIs are stable. */
  listWatched(userId: string): Promise<WatchedRow[]>;
  deleteWatched(userId: string, titleImdbId: string): Promise<void>;
  /**
   * Re-upload semantics, per source: drop every row of `source` for this user,
   * then insert these (stamped with that source). A Netflix re-upload never
   * touches the Letterboxd rows.
   */
  replaceImport(userId: string, source: ImportSource, rows: WatchedInput[]): Promise<void>;
  setServices(userId: string, input: ServicesInput): Promise<ServicesRow>;
  getServices(userId: string): Promise<ServicesRow | null>;
  setTaste(userId: string, input: TasteInput): Promise<TasteRow>;
  getTaste(userId: string): Promise<TasteRow | null>;
  /** Bump series progress on an existing row; a missing row is created as `liked`. */
  setProgress(userId: string, titleImdbId: string, progress: ProgressInput): Promise<void>;
  /** Tonight's stored picks and deck (any JSON the picks service produced), or null before the first run. */
  setTonight(userId: string, data: Record<string, unknown>): Promise<void>;
  getTonight(userId: string): Promise<{ data: Record<string, unknown>; generatedAt: string } | null>;
  /** The memory row, or null before the first rewrite. */
  getMemory(userId: string): Promise<MemoryRow | null>;
  /** Partial update: a field the caller omits keeps the value it had. */
  setMemory(userId: string, input: MemoryInput): Promise<void>;
  /** Append evidence. Ids are generated by the store. */
  addEpisodes(userId: string, rows: EpisodeInput[]): Promise<void>;
  /** Newest first. `query` is a case-insensitive substring match on the text. */
  listEpisodes(userId: string, opts?: { limit?: number; since?: string; query?: string }): Promise<EpisodeRow[]>;
  /** Users with any taste activity (watched or services) updated since `since`; the nightly job's audience. */
  activeUsers(since: Date): Promise<string[]>;
  /** Delete account: every per-user table, nothing left behind. */
  deleteUser(userId: string): Promise<void>;
}
