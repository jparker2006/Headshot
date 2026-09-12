import type { ThreadStore } from "./types";
import { MemoryThreadStore } from "./memory";

export * from "./types";
export { MemoryThreadStore } from "./memory";

const g = globalThis as unknown as { __headshotThreadStore?: Promise<ThreadStore> };

/**
 * The process-wide thread store. Postgres when DATABASE_URL is set, in-memory
 * otherwise — the rule the brain and the taste store both follow, so keyless
 * dev never imports the Postgres driver.
 */
export function getThreadStore(): Promise<ThreadStore> {
  if (!g.__headshotThreadStore) {
    g.__headshotThreadStore = (async () => {
      if (process.env.DATABASE_URL) {
        const { PostgresThreadStore } = await import("./postgres");
        return new PostgresThreadStore(process.env.DATABASE_URL);
      }
      console.log("[threads] DATABASE_URL unset; using the in-memory thread store");
      return new MemoryThreadStore();
    })();
  }
  return g.__headshotThreadStore;
}
