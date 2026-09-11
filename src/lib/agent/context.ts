import type { IndustryGraph, NodeInfo } from "@/lib/graph/engine";
import type { Brain, BrainNodeInput } from "@/lib/brain/types";
import type { TmdbClient } from "@/lib/tmdb/client";
import type { EmitFn, CanvasNode } from "./events";

/** Everything a tool needs. Built once per request. */
export interface AgentContext {
  graph: IndustryGraph;
  brain: Brain;
  tmdb: TmdbClient | null;
  emit: EmitFn;
  sessionId?: string;
  /** The user's latest question, for page-revision provenance. */
  question: string;
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
  for (const n of nodes) ctx.emit("node", n);
}

/** Compact description of a node for the model. */
export function describe(n: NodeInfo | CanvasNode): string {
  const meta = n.kind === "title" ? `${n.titleType}${n.year ? ` ${n.year}` : ""}` : `person${n.year ? ` b.${n.year}` : ""}`;
  return `${n.name} [${n.imdbId}, ${meta}]`;
}
