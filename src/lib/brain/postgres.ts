import type { Brain } from "./types";
import { MemoryBrain } from "./memory";

/** Phase 4 replaces this with the Neon + Drizzle implementation. */
export class PostgresBrain extends MemoryBrain implements Brain {
  constructor(_url: string) {
    super();
    console.warn("[brain] PostgresBrain not implemented yet; falling back to memory");
  }
}
