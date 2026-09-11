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

/** Four buckets, per SPEC v3: Letterboxd stars and swipes both land here. */
export const watched = pgTable(
  "watched",
  {
    userId: text("user_id").notNull(),
    titleImdbId: text("title_imdb_id").notNull(),
    /** liked | meh | unseen | want */
    rating: text("rating").$type<"liked" | "meh" | "unseen" | "want">().notNull(),
    watchedAt: timestamp("watched_at", { withTimezone: true, mode: "date" }),
    /** letterboxd | swipe | chat */
    source: text("source").$type<"letterboxd" | "swipe" | "chat">().notNull(),
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
