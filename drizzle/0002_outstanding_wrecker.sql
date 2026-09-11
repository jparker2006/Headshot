CREATE TABLE "services" (
	"user_id" text PRIMARY KEY NOT NULL,
	"provider_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"region" text DEFAULT 'US' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taste" (
	"user_id" text PRIMARY KEY NOT NULL,
	"vector" vector(512),
	"facts" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watched" (
	"user_id" text NOT NULL,
	"title_imdb_id" text NOT NULL,
	"rating" text NOT NULL,
	"watched_at" timestamp with time zone,
	"source" text NOT NULL,
	"season" integer,
	"episodes_watched" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watched_user_id_title_imdb_id_pk" PRIMARY KEY("user_id","title_imdb_id")
);
--> statement-breakpoint
CREATE INDEX "watched_user_id_idx" ON "watched" USING btree ("user_id");