import { waitUntil } from "@vercel/functions";
import { getIndustryGraph } from "@/lib/graph";
import { getBrain } from "@/lib/brain";
import { currentUserId } from "@/lib/auth/server";
import { getTitlesStore } from "@/lib/titles";
import { tmdbFromEnv } from "@/lib/tmdb/client";
import { createTasteHandlers } from "./routes";
import { getTasteStore } from "./index";

/**
 * The taste handlers wired to production dependencies: the real session, the
 * real store, and the industry graph with the brain's overlay merged in so a
 * live-discovered title can still be matched by an import.
 */
export const tasteHandlers = createTasteHandlers({
  userId: () => currentUserId(),
  store: getTasteStore,
  graph: async () => {
    const [graph, brain] = await Promise.all([getIndustryGraph(), getBrain()]);
    graph.setOverlay(await brain.getOverlay());
    return graph;
  },
  titles: getTitlesStore,
  tmdb: tmdbFromEnv,
  // Warming the titles cache outlives the response: the user never waits on
  // TMDB to see their own log line.
  schedule: (work) => waitUntil(work().catch((err) => console.warn("[titles] warm failed:", err))),
});
