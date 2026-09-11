import { getIndustryGraph } from "@/lib/graph";
import { getBrain } from "@/lib/brain";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ hits: [] });
  const [graph, brain] = await Promise.all([getIndustryGraph(), getBrain()]);
  graph.setOverlay(await brain.getOverlay());
  const hits = graph.searchByName(q, 8).map((n) => ({
    imdbId: n.imdbId,
    name: n.name,
    kind: n.kind,
    titleType: n.titleType,
    year: n.year,
    votes: n.votes,
  }));
  return Response.json({ hits });
}
