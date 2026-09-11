-- Added by hand: drizzle-kit does not emit CREATE EXTENSION for pgvector, and the
-- embeddings table below declares a vector(512) column, so the extension must exist
-- first. Keep this statement at the top of this migration.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"imdb_id" text PRIMARY KEY NOT NULL,
	"embedding" vector(512) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"imdb_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"title_type" text DEFAULT '' NOT NULL,
	"year" integer DEFAULT 0 NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"genres" text DEFAULT '' NOT NULL,
	"in_industry_graph" boolean DEFAULT false NOT NULL,
	"tmdb_id" integer,
	"poster_url" text,
	"known_as" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_session_id" text
);
--> statement-breakpoint
CREATE TABLE "overlay_edges" (
	"person_imdb_id" text NOT NULL,
	"title_imdb_id" text NOT NULL,
	"tier" integer NOT NULL,
	CONSTRAINT "overlay_edges_person_imdb_id_title_imdb_id_pk" PRIMARY KEY("person_imdb_id","title_imdb_id")
);
--> statement-breakpoint
CREATE TABLE "page_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"imdb_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"question" text NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"imdb_id" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"session_id" text,
	"text" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_imdb_id_pages_imdb_id_fk" FOREIGN KEY ("imdb_id") REFERENCES "public"."pages"("imdb_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nodes_kind_idx" ON "nodes" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "nodes_first_session_id_idx" ON "nodes" USING btree ("first_session_id");--> statement-breakpoint
CREATE INDEX "page_revisions_imdb_id_idx" ON "page_revisions" USING btree ("imdb_id");--> statement-breakpoint
CREATE INDEX "questions_at_idx" ON "questions" USING btree ("at");