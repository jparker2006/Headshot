CREATE TABLE "episodes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"title_imdb_id" text,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory" (
	"user_id" text PRIMARY KEY NOT NULL,
	"markdown" text DEFAULT '' NOT NULL,
	"pinned" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "titles" (
	"imdb_id" text PRIMARY KEY NOT NULL,
	"tmdb_id" integer,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"year" integer,
	"runtime" integer,
	"seasons" jsonb,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"poster_path" text,
	"providers" jsonb,
	"fetched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "episodes_user_id_at_idx" ON "episodes" USING btree ("user_id","at");