/**
 * The taste store: the private, per-user half of v3. Distinct from both the
 * read-only industry graph and the shared public brain — nothing in here is
 * ever rendered on the brain canvas or attached to a stored answer.
 *
 * Two implementations, one conformance suite (`tests/taste/store.test.ts`):
 * `MemoryTasteStore` for keyless dev and tests, `PostgresTasteStore` for Neon.
 */

/** SPEC v3: exactly four buckets. Letterboxd stars and swipes both land here. */
export type WatchedRating = "liked" | "meh" | "unseen" | "want";

/** Where a row came from. Only explicit signals exist; nothing is inferred. */
export type WatchedSource = "letterboxd" | "swipe" | "chat";

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
  /** Re-upload semantics: drop every `letterboxd` row, then insert these. */
  replaceImport(userId: string, rows: WatchedInput[]): Promise<void>;
  setServices(userId: string, input: ServicesInput): Promise<ServicesRow>;
  getServices(userId: string): Promise<ServicesRow | null>;
  setTaste(userId: string, input: TasteInput): Promise<TasteRow>;
  getTaste(userId: string): Promise<TasteRow | null>;
  /** Bump series progress on an existing row; a missing row is created as `liked`. */
  setProgress(userId: string, titleImdbId: string, progress: ProgressInput): Promise<void>;
  /** Delete account: all three tables, nothing left behind. */
  deleteUser(userId: string): Promise<void>;
}
