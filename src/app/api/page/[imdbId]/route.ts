import { getIndustryGraph } from "@/lib/graph";
import { getBrain } from "@/lib/brain";
import { tmdbFromEnv } from "@/lib/tmdb/client";

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
  // Cinema Daddy extras: trailer, where to watch, rating, bio. Best effort, never blocks the page.
  const tmdb = tmdbFromEnv();
  let extras: Record<string, unknown> | null = null;
  if (tmdb) {
    try {
      const found = brainNode?.tmdbId
        ? { tmdbId: brainNode.tmdbId, mediaType: (node?.kind ?? brainNode?.kind) === "person" ? ("person" as const) : node?.titleType === "movie" || node?.titleType === "tvMovie" ? ("movie" as const) : ("tv" as const) }
        : await tmdb.findByImdbId(imdbId);
      if (found) {
        if (found.mediaType === "person") {
          const facts = await tmdb.personFacts(found.tmdbId);
          extras = facts ? { kind: "person", ...facts, biography: facts.biography.slice(0, 900) } : null;
          if (facts && brainNode && !brainNode.posterUrl) await brain.updateNode(imdbId, { tmdbId: found.tmdbId, posterUrl: facts.profileUrl });
        } else {
          const region = process.env.STREAMING_REGION ?? "US";
          const [facts, trailer, providers] = await Promise.all([
            tmdb.titleFacts(found.mediaType, found.tmdbId),
            tmdb.trailer(found.mediaType, found.tmdbId),
            tmdb.watchProviders(found.mediaType, found.tmdbId, region),
          ]);
          extras = facts ? { kind: "title", ...facts, overview: facts.overview.slice(0, 700), trailer, providers, region } : null;
          if (facts && brainNode && !brainNode.posterUrl) await brain.updateNode(imdbId, { tmdbId: found.tmdbId, posterUrl: facts.posterUrl });
        }
      }
    } catch (err) {
      console.warn("[page] tmdb extras failed:", err instanceof Error ? err.message : err);
    }
  }
  return Response.json({
    extras,
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
