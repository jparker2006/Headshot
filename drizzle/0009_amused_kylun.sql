ALTER TABLE "memory" ADD COLUMN "dropped" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "memory" ADD COLUMN "rows_hash" text DEFAULT '' NOT NULL;