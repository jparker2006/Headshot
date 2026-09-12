ALTER TABLE "watched" ADD COLUMN "score" integer;--> statement-breakpoint
UPDATE "watched" SET "score" = 8, "rating" = 'rated' WHERE "rating" = 'liked';--> statement-breakpoint
UPDATE "watched" SET "score" = 5, "rating" = 'rated' WHERE "rating" = 'meh';
