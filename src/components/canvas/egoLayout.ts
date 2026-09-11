"use client";
import Graph from "graphology";
import type { EgoNetwork } from "@/lib/graph/ego";
import { COLORS, type EdgeAttrs, type NodeAttrs, edgeKey } from "./brainStore";

export interface EgoNodeAttrs extends NodeAttrs {
  ring: 0 | 1 | 2;
}

/**
 * Deterministic radial layout: center at the origin, ring 1 on a circle
 * sorted by prominence, ring 2 fanned out just beyond its parent's angle.
 */
export function buildEgoGraph(ego: EgoNetwork): Graph<EgoNodeAttrs, EdgeAttrs> {
  const g = new Graph<EgoNodeAttrs, EdgeAttrs>({ type: "undirected", multi: false });
  const ring1 = ego.nodes.filter((n) => n.ring === 1);
  const ring2 = ego.nodes.filter((n) => n.ring === 2);
  const center = ego.nodes.find((n) => n.ring === 0)!;
  const R1 = 100;
  const R2 = 175;

  const add = (n: EgoNetwork["nodes"][number], x: number, y: number, size: number) =>
    g.addNode(n.imdbId, {
      label: n.name,
      kind: n.kind,
      titleType: n.titleType,
      year: n.year,
      votes: n.votes,
      inIndustryGraph: !n.overlay,
      ring: n.ring,
      x,
      y,
      size,
      color: n.kind === "person" ? COLORS.person : COLORS.title,
    });

  add(center, 0, 0, 16);
  const angleOf = new Map<string, number>();
  ring1.forEach((n, i) => {
    const a = (i / ring1.length) * Math.PI * 2 - Math.PI / 2;
    angleOf.set(n.imdbId, a);
    const size = 5 + Math.min(6, Math.log10(Math.max(n.votes, 10)) - 2) * 1.2;
    add(n, Math.cos(a) * R1, Math.sin(a) * R1, size);
  });
  const perParent = new Map<string, EgoNetwork["nodes"]>();
  for (const n of ring2) {
    const list = perParent.get(n.parent!) ?? [];
    list.push(n);
    perParent.set(n.parent!, list);
  }
  for (const [parent, kids] of perParent) {
    const base = angleOf.get(parent) ?? 0;
    const spread = Math.min(0.5, (Math.PI * 2) / Math.max(ring1.length, 1) * 0.9);
    kids.forEach((n, i) => {
      const a = base + (i - (kids.length - 1) / 2) * (spread / Math.max(kids.length - 1, 1));
      const r = R2 + (i % 2) * 14;
      add(n, Math.cos(a) * r, Math.sin(a) * r, 3.5);
    });
  }
  for (const e of ego.edges) {
    if (!g.hasNode(e.personImdbId) || !g.hasNode(e.titleImdbId) || g.hasEdge(e.personImdbId, e.titleImdbId)) continue;
    g.addEdgeWithKey(edgeKey(e.personImdbId, e.titleImdbId), e.personImdbId, e.titleImdbId, {
      tier: e.tier,
      source: "packed",
      size: e.tier === 1 ? 0.9 : 0.5,
      color: e.tier === 1 ? "#3a3e4a" : COLORS.edgeWeak,
    });
  }
  return g;
}
