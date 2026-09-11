import { getIndustryGraph } from "@/lib/graph";
import { getBrain } from "@/lib/brain";
import { tmdbFromEnv } from "@/lib/tmdb/client";
import { ArrayEmitter } from "@/lib/agent/events";
import { expandFromTmdb } from "@/lib/agent/tools/tmdb";
import { checkLimits } from "@/lib/limits";
import { readSessionId } from "@/lib/session";
import { toCanvasNode } from "@/lib/agent/context";

export const dynamic = "force-dynamic";

/**
 * Double-click expand. Grows the brain from one node without a question:
 * from the industry graph when the node is there (free), and from TMDB when
 * it is not or when `live` is requested. Rate-limited like a question.
 */
export async function POST(req: Request): Promise<Response> {
  const { imdbId, live } = (await req.json().catch(() => ({}))) as { imdbId?: string; live?: boolean };
  if (!imdbId || !/^(nm|tt)\d+$/.test(imdbId)) return Response.json({ error: "bad id" }, { status: 400 });
  const [graph, brain, sessionId] = await Promise.all([getIndustryGraph(), getBrain(), readSessionId()]);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const limit = await checkLimits({ brain, ip });
  if (!limit.ok) return Response.json({ error: limit.reason, resting: true }, { status: 429 });

  graph.setOverlay(await brain.getOverlay());
  const emitter = new ArrayEmitter();
  const ctx = { graph, brain, tmdb: tmdbFromEnv(), emit: emitter.emit.bind(emitter), sessionId, question: `expand ${imdbId}` };
  const node = graph.nodeByImdbId(imdbId);

  if (node && !node.overlay && !live) {
    const hood = graph.neighborhood(node.id, 30);
    await brain.touchNodes([node, ...hood.map((h) => h.node)].map((n) => toCanvasNode(n)), sessionId);
    return Response.json({ added: hood.length, source: "graph" });
  }
  const result = await expandFromTmdb(ctx, imdbId, 12);
  if ("error" in result) return Response.json(result, { status: result.error === "not_found" ? 404 : 503 });
  return Response.json({ ...result, source: "tmdb" });
}
