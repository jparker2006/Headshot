CREATE TABLE "crawls" (
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"username" text NOT NULL,
	"status" text NOT NULL,
	"imported" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "crawls_user_id_source_pk" PRIMARY KEY("user_id","source")
);--> statement-breakpoint
DROP TABLE "tonight" CASCADE;
