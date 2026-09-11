/**
 * Turns the brain into what the canvas draws. The brain stores touched nodes
 * and overlay edges; the industry graph supplies the packed edges *between
 * touched nodes* so the canvas shows real structure without storing it twice.
 */
import type { IndustryGraph } from "@/lib/graph/engine";
import type { Brain, BrainNode } from "./types";

export interface RenderedEdge {
  personImdbId: string;
  titleImdbId: string;
  tier: number;
  source: "packed" | "overlay";
}

export interface RenderedBrain {
  nodes: BrainNode[];
  edges: RenderedEdge[];
  /** IMDb ids first added by the requesting session (for the glow). */
  sessionNodeIds: string[];
  buildId: string;
}

export async function renderBrain(graph: IndustryGraph, brain: Brain, sessionId?: string): Promise<RenderedBrain> {
  const snap = await brain.snapshot();
  const touched = new Set(snap.nodes.map((n) => n.imdbId));
  const edges = new Map<string, RenderedEdge>();

  for (const n of snap.nodes) {
    if (n.kind !== "person") continue;
    const id = graph.idOf(n.imdbId);
    if (id === undefined || graph.node(id).overlay) continue;
    for (const nb of graph.neighbors(id)) {
      const t = graph.node(nb.id);
      if (t.overlay || !touched.has(t.imdbId)) continue;
      edges.set(`${n.imdbId}|${t.imdbId}`, { personImdbId: n.imdbId, titleImdbId: t.imdbId, tier: nb.tier, source: "packed" });
    }
  }
  for (const e of snap.edges) {
    if (!touched.has(e.personImdbId) || !touched.has(e.titleImdbId)) continue;
    const key = `${e.personImdbId}|${e.titleImdbId}`;
    if (!edges.has(key)) edges.set(key, { personImdbId: e.personImdbId, titleImdbId: e.titleImdbId, tier: e.tier, source: "overlay" });
  }

  return {
    nodes: snap.nodes,
    edges: [...edges.values()],
    sessionNodeIds: sessionId ? await brain.sessionNodes(sessionId) : [],
    buildId: graph.buildId,
  };
}
