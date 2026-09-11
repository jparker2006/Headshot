import { getIndustryGraph } from "@/lib/graph";
import { getBrain } from "@/lib/brain";

export const dynamic = "force-dynamic";

/** A node's wiki page plus its graph neighborhood, for the side panel. */
export async function GET(_req: Request, ctx: RouteContext<"/api/page/[imdbId]">): Promise<Response> {
  const { imdbId } = await ctx.params;
  if (!/^(nm|tt)\d+$/.test(imdbId)) return Response.json({ error: "bad id" }, { status: 400 });
  const [graph, brain] = await Promise.all([getIndustryGraph(), getBrain()]);
  graph.setOverlay(await brain.getOverlay());
  const node = graph.nodeByImdbId(imdbId);
  const brainNode = await brain.getNode(imdbId);
  if (!node && !brainNode) return Response.json({ error: "not found" }, { status: 404 });
  const page = await brain.readPage(imdbId);
  const neighbors = node
    ? graph.neighborhood(node.id, 40).map((h) => ({
        imdbId: h.node.imdbId,
        name: h.node.name,
        kind: h.node.kind,
        titleType: h.node.titleType,
        year: h.node.year,
        tier: h.tier,
      }))
    : [];
  return Response.json({
    node: {
      imdbId,
      name: node?.name ?? brainNode?.name,
      kind: node?.kind ?? brainNode?.kind,
      titleType: node?.titleType ?? brainNode?.titleType ?? "",
      year: node?.year ?? brainNode?.year ?? 0,
      votes: node?.votes ?? brainNode?.votes ?? 0,
      genres: node?.genres ?? brainNode?.genres ?? "",
      inIndustryGraph: node ? !node.overlay : false,
      inBrain: !!brainNode,
      posterUrl: brainNode?.posterUrl,
      knownAs: brainNode?.knownAs,
      degree: node ? graph.degree(node.id) : 0,
    },
    page,
    neighbors,
  });
}
