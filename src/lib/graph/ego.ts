/**
 * Ego network: a node, its strongest neighbors (ring 1), and the strongest
 * neighbors of the top few of those (ring 2). Deterministic, no layout physics.
 */
import type { IndustryGraph, NodeInfo } from "./engine";

export interface EgoNode extends NodeInfo {
  ring: 0 | 1 | 2;
  /** Ring-2 nodes hang off this ring-1 node. */
  parent?: string;
}

export interface EgoEdge {
  personImdbId: string;
  titleImdbId: string;
  tier: number;
}

export interface EgoNetwork {
  center: string;
  nodes: EgoNode[];
  edges: EgoEdge[];
}

export function egoNetwork(graph: IndustryGraph, centerId: number, opts: { ring1?: number; ring2Parents?: number; ring2Each?: number } = {}): EgoNetwork {
  const ring1Max = opts.ring1 ?? 24;
  const ring2Parents = opts.ring2Parents ?? 8;
  const ring2Each = opts.ring2Each ?? 5;

  const center = graph.node(centerId);
  const nodes = new Map<string, EgoNode>();
  const edges = new Map<string, EgoEdge>();
  const addEdge = (a: NodeInfo, b: NodeInfo, tier: number) => {
    const [p, t] = a.kind === "person" ? [a, b] : [b, a];
    edges.set(`${p.imdbId}|${t.imdbId}`, { personImdbId: p.imdbId, titleImdbId: t.imdbId, tier });
  };

  nodes.set(center.imdbId, { ...center, ring: 0 });
  const ring1 = graph.neighborhood(centerId, ring1Max);
  for (const { node, tier } of ring1) {
    nodes.set(node.imdbId, { ...node, ring: 1 });
    addEdge(center, node, tier);
  }
  for (const { node: parent } of ring1.slice(0, ring2Parents)) {
    for (const { node, tier } of graph.neighborhood(parent.id, ring2Each + 1)) {
      if (node.id === centerId) continue;
      if (!nodes.has(node.imdbId)) nodes.set(node.imdbId, { ...node, ring: 2, parent: parent.imdbId });
      addEdge(parent, node, tier);
    }
  }
  // Cross-links between ring-1 nodes (e.g. two co-stars who also share a film).
  const ring1Ids = new Set(ring1.map((r) => r.node.id));
  for (const { node } of ring1) {
    for (const nb of graph.neighbors(node.id)) {
      if (ring1Ids.has(nb.id)) addEdge(node, graph.node(nb.id), nb.tier);
    }
  }
  return { center: center.imdbId, nodes: [...nodes.values()], edges: [...edges.values()] };
}
