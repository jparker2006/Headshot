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
