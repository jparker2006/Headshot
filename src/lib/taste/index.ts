import type { TasteStore } from "./types";
import { MemoryTasteStore } from "./memory";

export * from "./types";
export { MemoryTasteStore } from "./memory";
export { PROVIDERS, providerName, type Provider } from "./providers";

const g = globalThis as unknown as { __headshotTasteStore?: Promise<TasteStore> };

/**
 * The process-wide taste store. Postgres when DATABASE_URL is set, in-memory
 * otherwise — the same rule the brain follows, so keyless dev never imports the
 * Postgres driver. Unlike the brain there is no dev file: taste is per-user.
 */
export function getTasteStore(): Promise<TasteStore> {
  if (!g.__headshotTasteStore) {
    g.__headshotTasteStore = (async () => {
      if (process.env.DATABASE_URL) {
        const { PostgresTasteStore } = await import("./postgres");
        return new PostgresTasteStore(process.env.DATABASE_URL);
      }
      console.log("[taste] DATABASE_URL unset; using the in-memory taste store");
      return new MemoryTasteStore();
    })();
  }
  return g.__headshotTasteStore;
}
