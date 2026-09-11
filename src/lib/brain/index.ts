import type { Brain } from "./types";
import { MemoryBrain } from "./memory";
import { resilientBrain } from "./retry";

export * from "./types";
export { MemoryBrain } from "./memory";
export { resilientBrain, withRetry, isTransient } from "./retry";

const g = globalThis as unknown as { __headshotBrain?: Promise<Brain> };

/**
 * The process-wide brain. Postgres when DATABASE_URL is set, in-memory otherwise.
 * The Postgres implementation is loaded lazily so keyless dev never imports it.
 */
export function getBrain(): Promise<Brain> {
  if (!g.__headshotBrain) {
    g.__headshotBrain = (async () => {
      if (process.env.DATABASE_URL) {
        const { PostgresBrain } = await import("./postgres");
        return resilientBrain(new PostgresBrain(process.env.DATABASE_URL));
      }
      const file = process.env.HEADSHOT_BRAIN_FILE ?? (process.env.NODE_ENV === "test" ? undefined : "data/brain.json");
      console.log(`[brain] DATABASE_URL unset; using in-memory brain${file ? ` persisted to ${file}` : ""}`);
      return new MemoryBrain({ file });
    })();
  }
  return g.__headshotBrain;
}
