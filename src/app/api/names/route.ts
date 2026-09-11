import { getIndustryGraph } from "@/lib/graph";
import { getBrain } from "@/lib/brain";

export const dynamic = "force-dynamic";

/** Names and years for a list of IMDb ids: the cheapest lookup the lists need. */
export async function GET(req: Request): Promise<Response> {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^(nm|tt)\d+$/.test(s))
    .slice(0, 60);
  const [graph, brain] = await Promise.all([getIndustryGraph(), getBrain()]);
  const names: Record<string, { name: string; year: number; kind: string }> = {};
  for (const id of ids) {
    const n = graph.nodeByImdbId(id);
    if (n) {
      names[id] = { name: n.name, year: n.year, kind: n.kind };
      continue;
    }
    const b = await brain.getNode(id);
    if (b) names[id] = { name: b.name, year: b.year, kind: b.kind };
  }
  return Response.json({ names });
}
