import { waitUntil } from "@vercel/functions";
import { getIndustryGraph } from "@/lib/graph";
import { getBrain } from "@/lib/brain";
import { getTitles, getTitlesStore } from "@/lib/titles";
import { tmdbFromEnv } from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";

/**
 * Names and years for a list of IMDb ids: the cheapest lookup the lists need.
 * The industry graph answers first (in process, free); the v4 titles cache
 * covers titles the graph does not carry, and the brain is the last resort.
 * The ids that reached the cache are warmed after the response goes out.
 */
export async function GET(req: Request): Promise<Response> {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^(nm|tt)\d+$/.test(s))
    .slice(0, 60);
  const [graph, brain, titlesStore] = await Promise.all([getIndustryGraph(), getBrain(), getTitlesStore()]);
  const names: Record<string, { name: string; year: number; kind: string }> = {};

  const fromGraph = new Set<string>();
  for (const id of ids) {
    const n = graph.nodeByImdbId(id);
    if (n) {
      names[id] = { name: n.name, year: n.year, kind: n.kind };
      fromGraph.add(id);
    }
  }

  const titleIds = ids.filter((id) => id.startsWith("tt"));
  const cached = await titlesStore.getMany(titleIds.filter((id) => !fromGraph.has(id)));
  for (const [id, row] of cached) names[id] = { name: row.name, year: row.year ?? 0, kind: "title" };

  for (const id of ids) {
    if (names[id]) continue;
    const b = await brain.getNode(id);
    if (b) names[id] = { name: b.name, year: b.year, kind: b.kind };
  }

  // Fill the cache for next time; nobody waits on TMDB for a name.
  if (titleIds.length) {
    waitUntil(
      getTitles(titleIds, { store: titlesStore, tmdb: tmdbFromEnv(), graph })
        .then(() => {})
        .catch((err) => console.warn("[titles] warm failed:", err)),
    );
  }
  return Response.json({ names });
}
