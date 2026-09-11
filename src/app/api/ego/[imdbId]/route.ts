import { getIndustryGraph } from "@/lib/graph";
import { getBrain } from "@/lib/brain";
import { egoNetwork } from "@/lib/graph/ego";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/ego/[imdbId]">): Promise<Response> {
  const { imdbId } = await ctx.params;
  if (!/^(nm|tt)\d+$/.test(imdbId)) return Response.json({ error: "bad id" }, { status: 400 });
  const [graph, brain] = await Promise.all([getIndustryGraph(), getBrain()]);
  graph.setOverlay(await brain.getOverlay());
  const id = graph.idOf(imdbId);
  if (id === undefined) return Response.json({ error: "not in graph" }, { status: 404 });
  return Response.json(egoNetwork(graph, id), { headers: { "cache-control": "no-store" } });
}
