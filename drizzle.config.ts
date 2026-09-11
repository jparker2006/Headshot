import { defineConfig } from "drizzle-kit";

/**
 * Brain migrations. `pnpm db:generate` writes SQL into ./drizzle; `pnpm db:migrate`
 * applies it to the Neon database in DATABASE_URL. The same folder is replayed
 * against PGlite in tests, so generated SQL must stay portable Postgres.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/brain/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
