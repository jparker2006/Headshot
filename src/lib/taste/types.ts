/**
 * The taste store: the private, per-user half of v3. Distinct from both the
 * read-only industry graph and the shared public brain — nothing in here is
 * ever rendered on the brain canvas or attached to a stored answer.
 *
 * Two implementations, one conformance suite (`tests/taste/store.test.ts`):
 * `MemoryTasteStore` for keyless dev and tests, `PostgresTasteStore` for Neon.
 */

/**
 * SPEC v5: the *state* of a row. The opinion moved out of the word and into
 * `score` (1–10), so `rated` covers everything v3/v4 called liked or meh;
 * `seen` stays the neutral "watched, no opinion" a Netflix import lands in,
 * `want` is Later and `unseen` is "never seen". Helpers in `./score.ts`
 * answer the questions the old words used to ("liked" is `score >= 7`).
 */
export type WatchedRating = "rated" | "want" | "seen" | "unseen";

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

/** SPEC v5.3: a claim is for them or against them. */
export type ClaimPolarity = "love" | "avoid";

/**
 * SPEC v5.3: one belief, with the log rows that prove it. `evidence` holds
 * imdb ids — `tt…` titles the user has a row for, or `nm…` people the log's
 * people list knows.
 */
export interface Claim {
  id: string;
  text: string;
  evidence: string[];
  polarity: ClaimPolarity;
}

/**
 * SPEC v5.3: the memory as structure, not prose. `sentence` is the one line
 * that says who they are; `rejected` holds the texts the user said "not me"
 * to, which the rewrite must never restate.
 */
export interface MemoryClaims {
  sentence: string;
  claims: Claim[];
  rejected: { text: string }[];
}

/** The beliefs layer: prose the rewrite job owns plus lines the user pinned. */
export interface MemoryRow {
  markdown: string;
  pinned: string;
  /**
   * SPEC v5.2: titles the last rewrite removed from the prose because they are
   * no longer in the log. Shown once on You, then dismissed.
   */
  dropped: string[];
  /**
   * A cheap hash of the rows the last rewrite was built from. Unchanged rows
   * plus no new episodes is a no-op.
   */
  rowsHash: string;
  /**
   * SPEC v5.3: the claims the last rewrite produced. Null for a row written
   * before the migration — `markdown` is still the fallback.
   */
  claims: MemoryClaims | null;
  updatedAt: string;
}

export interface MemoryInput {
  markdown?: string;
  pinned?: string;
  dropped?: string[];
  rowsHash?: string;
  claims?: MemoryClaims | null;
}

export interface WatchedRow {
  titleImdbId: string;
  rating: WatchedRating;
  /** 1–10, and non-null exactly when `rating` is `rated`. */
  score: number | null;
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
  /** 1–10, required when `rating` is `rated` and rejected otherwise. */
  score?: number | null;
  watchedAt?: string | null;
  season?: number | null;
  episodesWatched?: number;
}

/** The only crawl there is, but the row says which import it belongs to. */
export type CrawlSource = "letterboxd";

/**
 * How a crawl went. `running` is the only non-terminal state; `private` and
 * `not_found` are answers about the profile rather than failures of ours, and
 * `failed` carries the message in `error`.
 */
export type CrawlStatus = "running" | "done" | "private" | "not_found" | "failed";

/** One row of the `crawls` table: the latest crawl for (user, source). */
export interface CrawlRow {
  source: CrawlSource;
  username: string;
  status: CrawlStatus;
  /** Rows written; 0 until the crawl finishes. */
  imported: number;
  startedAt: string;
  /** ISO timestamp, or null while the crawl is still running. */
  finishedAt: string | null;
  error: string | null;
}

/** What `finishCrawl` is told: everything the running row did not know yet. */
export interface CrawlResultInput {
  username?: string;
  status: Exclude<CrawlStatus, "running">;
  imported?: number;
  error?: string | null;
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
  /**
   * Bump series progress on an existing row. A missing row is created as
   * `seen` (watched, no opinion): "one more episode of X" says they are
   * watching it, not what they think of it, and v5 has no bucket left that
   * could stand in for a score they never gave.
   */
  setProgress(userId: string, titleImdbId: string, progress: ProgressInput): Promise<void>;
  /** The latest import crawl for this user and source, or null before the first one. */
  getCrawl(userId: string, source: CrawlSource): Promise<CrawlRow | null>;
  /** Record a crawl as started: status `running`, the clock's `startedAt`, nothing finished. */
  startCrawl(userId: string, source: CrawlSource, username: string): Promise<CrawlRow>;
  /** Close the running crawl with how it went. A crawl that was never started is created finished. */
  finishCrawl(userId: string, source: CrawlSource, result: CrawlResultInput): Promise<CrawlRow>;
  /** The memory row, or null before the first rewrite. */
  getMemory(userId: string): Promise<MemoryRow | null>;
  /** Partial update: a field the caller omits keeps the value it had. */
  setMemory(userId: string, input: MemoryInput): Promise<void>;
  /** Append evidence. Ids are generated by the store. */
  addEpisodes(userId: string, rows: EpisodeInput[]): Promise<void>;
  /**
   * Delete episodes for one user (SPEC v5.2, row deletes). Both filters are
   * optional and AND together; with neither, every episode goes.
   */
  deleteEpisodes(userId: string, opts?: { titleImdbId?: string; kinds?: EpisodeKind[] }): Promise<void>;
  /** Newest first. `query` is a case-insensitive substring match on the text. */
  listEpisodes(userId: string, opts?: { limit?: number; since?: string; query?: string }): Promise<EpisodeRow[]>;
  /** Users with any taste activity (watched or services) updated since `since`; the nightly job's audience. */
  activeUsers(since: Date): Promise<string[]>;
  /** Delete account: every per-user table, nothing left behind. */
  deleteUser(userId: string): Promise<void>;
}
