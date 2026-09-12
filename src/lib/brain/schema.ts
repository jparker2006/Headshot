/**
 * Drizzle schema for the brain: the shared, mutable half of the two graphs.
 * The industry graph is packed and read-only and never lives here; this holds
 * only what questions have touched — nodes, live-discovered overlay edges,
 * agent-written pages and their revision log, questions, and embeddings.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";
import type { NodeKind, TitleType } from "@/lib/graph/format";

/**
 * Embedding width. The spec trims `openai/text-embedding-3-small` to 512 dims.
 * The column width is fixed at migration time, so this is a constant and not
 * read from env; `embeddingDims()` in the agent provider must agree with it.
 */
export const EMBEDDING_DIMS = 512;

/** Every entity anyone has ever touched: a subset of the industry graph plus live finds. */
export const nodes = pgTable(
  "nodes",
  {
    imdbId: text("imdb_id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").$type<NodeKind>().notNull(),
    titleType: text("title_type").$type<TitleType | "">().notNull().default(""),
    year: integer("year").notNull().default(0),
    votes: integer("votes").notNull().default(0),
    genres: text("genres").notNull().default(""),
    /** True if the node exists in the packed industry graph (so it is not overlay). */
    inIndustryGraph: boolean("in_industry_graph").notNull().default(false),
    tmdbId: integer("tmdb_id"),
    posterUrl: text("poster_url"),
    knownAs: text("known_as"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    /** Session that first added this node; drives the canvas session glow. */
    firstSessionId: text("first_session_id"),
  },
  (t) => [
    index("nodes_kind_idx").on(t.kind),
    index("nodes_first_session_id_idx").on(t.firstSessionId),
  ],
);

/** Live-discovered credit edges. The packed graph's edges are never stored here. */
export const overlayEdges = pgTable(
  "overlay_edges",
  {
    personImdbId: text("person_imdb_id").notNull(),
    titleImdbId: text("title_imdb_id").notNull(),
    tier: integer("tier").notNull(),
  },
  (t) => [primaryKey({ columns: [t.personImdbId, t.titleImdbId] })],
);

/** Current body of an entity's wiki page. Agent-authored; humans never edit. */
export const pages = pgTable("pages", {
  imdbId: text("imdb_id").primaryKey(),
  body: text("body").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Append-only revision log: which question caused which edit. */
export const pageRevisions = pgTable(
  "page_revisions",
  {
    id: serial("id").primaryKey(),
    imdbId: text("imdb_id")
      .notNull()
      .references(() => pages.imdbId, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    question: text("question").notNull(),
    body: text("body").notNull(),
  },
  (t) => [index("page_revisions_imdb_id_idx").on(t.imdbId)],
);

/** Every question asked, for the global daily cap. No conversations are stored. */
export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    at: timestamp("at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    sessionId: text("session_id"),
    text: text("text").notNull(),
  },
  (t) => [index("questions_at_idx").on(t.at)],
);

/**
 * Stored answers (v2): one row per (shape, sorted entity ids). A repeat
 * question replays the row without a model call; public rows get permalinks.
 */
export const answers = pgTable(
  "answers",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    shape: text("shape").notNull(),
    entityIds: jsonb("entity_ids").$type<string[]>().notNull(),
    cacheKey: text("cache_key").notNull().unique(),
    question: text("question").notNull(),
    chosenPath: jsonb("chosen_path").$type<string[] | null>(),
    summary: jsonb("summary"),
    narration: text("narration").notNull(),
    followups: jsonb("followups").$type<string[]>().notNull().default([]),
    events: jsonb("events").$type<{ type: string; data: unknown }[]>().notNull().default([]),
    graphBuildId: text("graph_build_id").notNull(),
    sessionId: text("session_id"),
    public: boolean("public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("answers_created_at_idx").on(t.createdAt)],
);

/** pgvector embeddings for the top tier of entities, for fuzzy resolution. */
export const embeddings = pgTable("embeddings", {
  imdbId: text("imdb_id").primaryKey(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMS }).notNull(),
});

export const pagesRelations = relations(pages, ({ many }) => ({
  revisions: many(pageRevisions),
}));

export const pageRevisionsRelations = relations(pageRevisions, ({ one }) => ({
  page: one(pages, { fields: [pageRevisions.imdbId], references: [pages.imdbId] }),
}));

// ---- v3: the taste store -------------------------------------------------
// The private half of the product. Three tables, keyed by Neon Auth user id,
// holding only what the user told us explicitly. Deleting an account deletes
// all three rows sets (`TasteStore.deleteUser`). Nothing else is kept.

/** The log (SPEC v5): a state plus a 1–10 score. Imports, swipes and chat all land here. */
export const watched = pgTable(
  "watched",
  {
    userId: text("user_id").notNull(),
    titleImdbId: text("title_imdb_id").notNull(),
    /** v5 state: rated | want | seen | unseen. The opinion lives in `score`. */
    rating: text("rating").$type<"rated" | "want" | "seen" | "unseen">().notNull(),
    /** 1–10 in tenths, non-null exactly when `rating` is `rated` (SPEC v5.1, migration 0008 widened it from integer to real). */
    score: real("score"),
    watchedAt: timestamp("watched_at", { withTimezone: true, mode: "date" }),
    /** letterboxd | swipe | chat | log | netflix | imdb */
    source: text("source").$type<"letterboxd" | "swipe" | "chat" | "log" | "netflix" | "imdb">().notNull(),
    /** Series only: the season the user has marked. */
    season: integer("season"),
    /** Series only: the counter behind "one more episode of X". */
    episodesWatched: integer("episodes_watched").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.titleImdbId] }), index("watched_user_id_idx").on(t.userId)],
);

/** The services the user actually pays for, as TMDB watch-provider ids. */
export const services = pgTable("services", {
  userId: text("user_id").primaryKey(),
  providerIds: jsonb("provider_ids").$type<number[]>().notNull().default([]),
  region: text("region").notNull().default("US"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Derived facts about a user's taste. Facts shape mirrors `TasteFacts`. */
export interface TasteFactsJson {
  people: { imdbId: string; name: string; count: number }[];
  eras: Record<string, number>;
  avgRuntimeFinished: number | null;
  tvShare: number | null;
  genresAvoided: string[];
}

/** One row per user: the nightly taste vector plus the facts derived with it. */
export const taste = pgTable("taste", {
  userId: text("user_id").primaryKey(),
  vector: vector("vector", { dimensions: EMBEDDING_DIMS }),
  facts: jsonb("facts").$type<TasteFactsJson>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// ---- v4: titles cache, memory, episodes ----------------------------------
// Three tables behind "You". `titles` is shared across users (a cache of TMDB
// facts keyed by IMDb id, not per-user data); `memory` and `episodes` are
// private and are cleared by `TasteStore.deleteUser` with the rest.

/** One season of a series, with the episode count Numbers counts hours from. */
export interface TitleSeason {
  season: number;
  episodes: number;
}

/**
 * Lazily filled cache of the TMDB facts the graph does not carry: runtime,
 * seasons, genres, poster and the watch-providers snapshot. Warmed on log,
 * import and pick; read by Numbers, the log table, `/api/names` and posters.
 */
export const titles = pgTable("titles", {
  imdbId: text("imdb_id").primaryKey(),
  tmdbId: integer("tmdb_id"),
  /** movie | series */
  kind: text("kind").$type<"movie" | "series">().notNull(),
  name: text("name").notNull(),
  year: integer("year"),
  /** Minutes. For a series, the average episode runtime. */
  runtime: integer("runtime"),
  seasons: jsonb("seasons").$type<TitleSeason[] | null>(),
  genres: jsonb("genres").$type<string[]>().notNull().default([]),
  posterPath: text("poster_path"),
  /** The TMDB watch-providers payload for the default region, as fetched. */
  providers: jsonb("providers").$type<Record<string, unknown> | null>(),
  /** Null while only the graph half is known, so the row is retried next time. */
  fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" }),
});

/** The beliefs layer: prose the rewrite job owns plus lines the user pinned. */
export const memory = pgTable("memory", {
  userId: text("user_id").primaryKey(),
  markdown: text("markdown").notNull().default(""),
  pinned: text("pinned").notNull().default(""),
  /** SPEC v5.2: titles the last rewrite dropped because the log no longer has them. */
  dropped: jsonb("dropped").$type<string[]>().notNull().default([]),
  /** SPEC v5.2: hash of the rows the last rewrite saw; unchanged rows are a no-op. */
  rowsHash: text("rows_hash").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** The evidence layer: one line per thing the user did or said. Append-only. */
export const episodes = pgTable(
  "episodes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    at: timestamp("at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    /** log | swipe | chat | play */
    kind: text("kind").$type<"log" | "swipe" | "chat" | "play">().notNull(),
    titleImdbId: text("title_imdb_id"),
    text: text("text").notNull(),
  },
  (t) => [index("episodes_user_id_at_idx").on(t.userId, t.at)],
);

// ---- v5: server-side chat threads ----------------------------------------
// Signed-in conversations live here, one row per UI message. Signed-out
// threads stay in localStorage and never reach the server (SPEC v5).

/** One conversation. `title` is null until the first user turn names it. */
export const threads = pgTable(
  "threads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** The first user text, sliced to 60 chars. Null until then; the UI shows "new chat". */
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("threads_user_id_updated_at_idx").on(t.userId, t.updatedAt)],
);

/** One UI message, parts and all. Deleting a thread deletes its messages. */
export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    /** user | assistant | system */
    role: text("role").notNull(),
    /** The UI message's parts, exactly as the client renders them. */
    parts: jsonb("parts").$type<unknown[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("messages_thread_id_idx").on(t.threadId)],
);

// ---- v5: import crawls ---------------------------------------------------
// The Letterboxd crawl's state, one row per (user, source): what username was
// asked for, how it went, and when. The 24h cache and the Log page's
// "importing from Letterboxd…" both read this row (SPEC v5, "Letterboxd crawl").

export const crawls = pgTable(
  "crawls",
  {
    userId: text("user_id").notNull(),
    /** letterboxd — the only crawl there is, but the row says so. */
    source: text("source").$type<"letterboxd">().notNull(),
    username: text("username").notNull(),
    /** running | done | private | not_found | failed */
    status: text("status").$type<"running" | "done" | "private" | "not_found" | "failed">().notNull(),
    /** Rows written by the finished crawl. */
    imported: integer("imported").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    /** Null while the crawl is still running. */
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
    error: text("error"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.source] })],
);
