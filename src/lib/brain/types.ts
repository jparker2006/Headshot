/**
 * The brain: the shared, mutable graph of everything anyone has touched.
 * Distinct from the read-only industry graph. Lives in Postgres in production
 * and in memory for tests and keyless dev.
 */
import type { NodeKind, TitleType } from "@/lib/graph/format";
import type { Overlay, OverlayEdge } from "@/lib/graph/engine";

export interface BrainNode {
  imdbId: string;
  name: string;
  kind: NodeKind;
  titleType: TitleType | "";
  year: number;
  votes: number;
  genres: string;
  /** True if the node exists in the packed industry graph. */
  inIndustryGraph: boolean;
  tmdbId?: number;
  posterUrl?: string;
  knownAs?: string;
  firstSeenAt: string;
}

export type BrainNodeInput = Omit<BrainNode, "firstSeenAt"> & { firstSeenAt?: string };

export interface BrainEdge extends OverlayEdge {
  /** Overlay edges are the ones the brain owns; packed edges are derived at render time. */
  source: "overlay";
}

export interface PageRevision {
  at: string;
  /** The question that triggered this revision. */
  question: string;
  body: string;
}

export interface Page {
  imdbId: string;
  body: string;
  revisions: PageRevision[];
  updatedAt: string;
}

export interface BrainSnapshot {
  nodes: BrainNode[];
  edges: BrainEdge[];
}

export interface Brain {
  /** Overlay view for the graph engine: nodes not in the industry graph, plus overlay edges. */
  getOverlay(): Promise<Overlay>;
  /** Record that these nodes are now part of the brain (idempotent), attributing them to a session. */
  touchNodes(nodes: BrainNodeInput[], sessionId?: string): Promise<void>;
  /** Add live-discovered credit edges (idempotent). */
  addEdges(edges: OverlayEdge[]): Promise<void>;
  getNode(imdbId: string): Promise<BrainNode | null>;
  updateNode(imdbId: string, patch: Partial<Pick<BrainNode, "tmdbId" | "posterUrl" | "knownAs">>): Promise<void>;
  readPage(imdbId: string): Promise<Page | null>;
  writePage(input: { imdbId: string; body: string; question: string }): Promise<Page>;
  snapshot(): Promise<BrainSnapshot>;
  /** IMDb ids of nodes first added by this session. */
  sessionNodes(sessionId: string): Promise<string[]>;
  /** Questions asked today (UTC), for the daily cap. */
  countQuestionsToday(): Promise<number>;
  recordQuestion(input: { sessionId?: string; text: string }): Promise<void>;
}
