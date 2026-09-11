import { getIndustryGraph } from "@/lib/graph";
import { getBrain } from "@/lib/brain";
import { getTasteStore } from "@/lib/taste";
import { currentUserId } from "@/lib/auth/server";
import { tmdbFromEnv } from "@/lib/tmdb/client";
import { getTitlesStore } from "@/lib/titles";
import { waitUntil } from "@vercel/functions";
import { chatModelFromEnv, mockAgentEnabled } from "@/lib/agent/provider";
import { createTonightHandlers } from "./routes";

/** Tonight's handlers wired to production dependencies. */
export const tonightHandlers = createTonightHandlers({
  userId: () => currentUserId(),
  store: getTasteStore,
  graph: async () => {
    const [graph, brain] = await Promise.all([getIndustryGraph(), getBrain()]);
    graph.setOverlay(await brain.getOverlay());
    return graph;
  },
  tmdb: tmdbFromEnv,
  titles: getTitlesStore,
  schedule: (work) => waitUntil(work().catch((err) => console.warn("[titles] warm failed:", err))),
  model: () => (process.env.OPENROUTER_API_KEY && !mockAgentEnabled() ? chatModelFromEnv() : null),
  log: (m) => console.log(m),
});
