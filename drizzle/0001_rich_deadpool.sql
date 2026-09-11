CREATE TABLE "answers" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"shape" text NOT NULL,
	"entity_ids" jsonb NOT NULL,
	"cache_key" text NOT NULL,
	"question" text NOT NULL,
	"chosen_path" jsonb,
	"summary" jsonb,
	"narration" text NOT NULL,
	"followups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"graph_build_id" text NOT NULL,
	"session_id" text,
	"public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answers_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE INDEX "answers_created_at_idx" ON "answers" USING btree ("created_at");