import type { IndustryGraph, NodeInfo } from "@/lib/graph/engine";
import type { Brain, BrainNodeInput } from "@/lib/brain/types";
import type { TmdbClient } from "@/lib/tmdb/client";
import type { EmitFn, CanvasNode } from "./events";
import type { EmbedFn } from "./embeddings";

/** Everything a tool needs. Built once per request. */
export interface AgentContext {
  graph: IndustryGraph;
  brain: Brain;
  tmdb: TmdbClient | null;
  emit: EmitFn;
  sessionId?: string;
  /** The user's latest question, for page-revision provenance. */
  question: string;
  /** Every node touched this turn, for automatic page writing. */
  touched: CanvasNode[];
  /** Query embedder for semantic fallback; absent in keyless dev and tests. */
  embed?: EmbedFn;
}

/** Nearest graph entities to a description, via the brain's pgvector table. Empty when unavailable. */
export async function semanticCandidates(ctx: AgentContext, text: string, limit: number, kind?: "person" | "title"): Promise<NodeInfo[]> {
  if (!ctx.embed || !ctx.brain.semanticSearch) return [];
  try {
    const vec = await ctx.embed(text);
    const hits = await ctx.brain.semanticSearch(vec, limit * 2);
    return hits
      .map((h) => ctx.graph.nodeByImdbId(h.imdbId))
      .filter((n): n is NodeInfo => !!n && (!kind || n.kind === kind))
      .slice(0, limit);
  } catch (err) {
    console.warn("[semantic] failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

export function toCanvasNode(n: NodeInfo, extra: Partial<CanvasNode> = {}): CanvasNode {
  return {
    imdbId: n.imdbId,
    name: n.name,
    kind: n.kind,
    titleType: n.titleType,
    year: n.year,
    votes: n.votes,
    genres: n.genres,
    inIndustryGraph: !n.overlay,
    ...extra,
  };
}

export function toBrainInput(n: CanvasNode): BrainNodeInput {
  return {
    imdbId: n.imdbId,
    name: n.name,
    kind: n.kind,
    titleType: n.titleType,
    year: n.year,
    votes: n.votes,
    genres: n.genres,
    inIndustryGraph: n.inIndustryGraph,
    posterUrl: n.posterUrl,
  };
}

/** Mark nodes as part of the brain and tell the canvas about them. */
export async function touch(ctx: AgentContext, nodes: CanvasNode[]): Promise<void> {
  await ctx.brain.touchNodes(nodes.map(toBrainInput), ctx.sessionId);
  for (const n of nodes) {
    ctx.emit("node", n);
    ctx.touched.push(n);
  }
}

/** Compact description of a node for the model. */
export function describe(n: NodeInfo | CanvasNode): string {
  const meta = n.kind === "title" ? `${n.titleType}${n.year ? ` ${n.year}` : ""}` : `person${n.year ? ` b.${n.year}` : ""}`;
  return `${n.name} [${n.imdbId}, ${meta}]`;
}
