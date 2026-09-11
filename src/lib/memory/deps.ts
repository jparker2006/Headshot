/**
 * The memory rewrite wired to production dependencies. Routes hand this to
 * their `rewrite` dep and run it through `waitUntil`: it is background work,
 * it never throws, and with no OpenRouter key (keyless dev) it does nothing.
 */
import { getIndustryGraph } from "@/lib/graph";
import { getTasteStore } from "@/lib/taste";
import { memoryModelFromEnv } from "@/lib/agent/provider";
import { rewriteMemory } from "./rewrite";

export async function rewriteMemoryForUser(userId: string): Promise<void> {
  const model = memoryModelFromEnv();
  if (!model) return;
  const [graph, store] = await Promise.all([getIndustryGraph(), getTasteStore()]);
  await rewriteMemory({ store, graph, model, log: (m) => console.log(m) }, userId);
}
