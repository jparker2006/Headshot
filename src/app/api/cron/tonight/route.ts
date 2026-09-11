import { getIndustryGraph } from "@/lib/graph";
import { getBrain } from "@/lib/brain";
import { getTasteStore } from "@/lib/taste";
import { getTitlesStore } from "@/lib/titles";
import { tmdbFromEnv } from "@/lib/tmdb/client";
import { chatModelFromEnv, mockAgentEnabled } from "@/lib/agent/provider";
import { cronAuthorized, runNightly } from "@/lib/picks/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The overnight run. Scheduled in vercel.json; callable by hand with the secret. */
export async function GET(req: Request): Promise<Response> {
  if (!cronAuthorized(req, process.env.CRON_SECRET)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const [graph, brain, store, titles] = await Promise.all([getIndustryGraph(), getBrain(), getTasteStore(), getTitlesStore()]);
  graph.setOverlay(await brain.getOverlay());
  const result = await runNightly({
    graph,
    tmdb: tmdbFromEnv(),
    store,
    // No `schedule`: the nightly job awaits the titles warm, so the cache is
    // full by the time anyone opens the app.
    titles,
    model: process.env.OPENROUTER_API_KEY && !mockAgentEnabled() ? chatModelFromEnv() : null,
    log: (m) => console.log(m),
  });
  return Response.json(result);
}
