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

/** One replayable canvas event captured while an answer was produced. */
export interface RecordedEvent {
  type: string;
  data: unknown;
}

/**
 * A stored answer (v2). Keyed by question shape plus sorted entity ids so a
 * repeat of the same deterministic question replays without a model call.
 */
export interface StoredAnswer {
  /** Short public id, e.g. "7f3k2q". */
  id: string;
  /** URL slug, e.g. "heath-ledger-to-natalie-portman". */
  slug: string;
  shape: string;
  /** Sorted IMDb ids of the resolved entities. */
  entityIds: string[];
  /** `${shape}:${entityIds.join(",")}` */
  cacheKey: string;
  question: string;
  /** The chosen path's ids, source first, when the shape has one. */
  chosenPath: string[] | null;
  /** Free-form summary of the deterministic result (tied paths, shared credits…). */
  summary: unknown;
  narration: string;
  followups: string[];
  /** Canvas events to replay, in order. */
  events: RecordedEvent[];
  graphBuildId: string;
  sessionId: string | null;
  public: boolean;
  createdAt: string;
}

export type StoredAnswerInput = Omit<StoredAnswer, "createdAt"> & { createdAt?: string };

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
  /** Answer store (v2). `saveAnswer` replaces any answer with the same cache key. */
  getAnswer(cacheKey: string): Promise<StoredAnswer | null>;
  answerById(id: string): Promise<StoredAnswer | null>;
  saveAnswer(answer: StoredAnswerInput): Promise<StoredAnswer>;
  /**
   * Store or replace embeddings for the top tier of entities. Optional: only the
   * Postgres brain has pgvector, and the in-memory brain no-ops.
   */
  upsertEmbeddings?(rows: { imdbId: string; embedding: number[] }[]): Promise<void>;
  /** Nearest entities by cosine distance, closest first. Optional; see above. */
  semanticSearch?(embedding: number[], limit: number): Promise<{ imdbId: string; distance: number }[]>;
}
