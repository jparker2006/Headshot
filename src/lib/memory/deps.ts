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
  await rewriteMemoryNow(userId);
}

/**
 * The same rewrite, awaited, handing back the new markdown (null when there is
 * no model or the rewrite was skipped). The swipe-session route needs the
 * result in the response, because the diff is the screen.
 */
export async function rewriteMemoryNow(userId: string): Promise<string | null> {
  const model = memoryModelFromEnv();
  if (!model) return null;
  const [graph, store] = await Promise.all([getIndustryGraph(), getTasteStore()]);
  return rewriteMemory({ store, graph, model, log: (m) => console.log(m) }, userId);
}
