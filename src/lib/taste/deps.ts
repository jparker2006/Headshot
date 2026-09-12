import { waitUntil } from "@vercel/functions";
import { getIndustryGraph } from "@/lib/graph";
import { getBrain } from "@/lib/brain";
import { currentUserId } from "@/lib/auth/server";
import { getTitlesStore } from "@/lib/titles";
import { tmdbFromEnv } from "@/lib/tmdb/client";
import { personFaces } from "@/lib/tmdb/faces";
import { rewriteMemoryForUser } from "@/lib/memory/deps";
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
  // Numbers asks for at most twelve headshots, and the brain caches each one
  // the first time anyone sees it.
  faces: async (ids) => personFaces(ids, { brain: await getBrain(), tmdb: tmdbFromEnv() }),
  // Warming the titles cache outlives the response: the user never waits on
  // TMDB to see their own log line.
  // A log is new evidence: the memory is rewritten after the response.
  rewrite: rewriteMemoryForUser,
  // The Letterboxd crawl's window on the world: the platform `fetch` and a
  // real timer. Everything else about it is pure and injected in tests.
  crawl: { fetch: (url, init) => fetch(url, init) },
  schedule: (work) => waitUntil(work().catch((err) => console.warn("[taste] background failed:", err))),
});
