import type { Overlay, OverlayEdge } from "@/lib/graph/engine";
import type { Brain, BrainEdge, BrainNode, BrainNodeInput, BrainSnapshot, Page } from "./types";

/** In-memory brain. Used by tests and by `pnpm dev` when DATABASE_URL is unset. */
export class MemoryBrain implements Brain {
  private nodes = new Map<string, BrainNode>();
  private edges = new Map<string, BrainEdge>();
  private pages = new Map<string, Page>();
  private sessions = new Map<string, Set<string>>();
  private questions: { at: string; sessionId?: string; text: string }[] = [];
  private now: () => Date;

  constructor(opts: { now?: () => Date } = {}) {
    this.now = opts.now ?? (() => new Date());
  }

  async getOverlay(): Promise<Overlay> {
    return {
      nodes: [...this.nodes.values()]
        .filter((n) => !n.inIndustryGraph)
        .map((n) => ({ imdbId: n.imdbId, name: n.name, kind: n.kind, titleType: n.titleType, year: n.year, votes: n.votes, genres: n.genres })),
      edges: [...this.edges.values()].map(({ personImdbId, titleImdbId, tier }) => ({ personImdbId, titleImdbId, tier })),
    };
  }

  async touchNodes(nodes: BrainNodeInput[], sessionId?: string): Promise<void> {
    for (const n of nodes) {
      if (this.nodes.has(n.imdbId)) continue;
      this.nodes.set(n.imdbId, { ...n, firstSeenAt: n.firstSeenAt ?? this.now().toISOString() });
      if (sessionId) {
        let set = this.sessions.get(sessionId);
        if (!set) this.sessions.set(sessionId, (set = new Set()));
        set.add(n.imdbId);
      }
    }
  }

  async addEdges(edges: OverlayEdge[]): Promise<void> {
    for (const e of edges) this.edges.set(`${e.personImdbId}|${e.titleImdbId}`, { ...e, source: "overlay" });
  }

  async getNode(imdbId: string): Promise<BrainNode | null> {
    return this.nodes.get(imdbId) ?? null;
  }

  async updateNode(imdbId: string, patch: Partial<Pick<BrainNode, "tmdbId" | "posterUrl" | "knownAs">>): Promise<void> {
    const n = this.nodes.get(imdbId);
    if (n) Object.assign(n, patch);
  }

  async readPage(imdbId: string): Promise<Page | null> {
    return this.pages.get(imdbId) ?? null;
  }

  async writePage({ imdbId, body, question }: { imdbId: string; body: string; question: string }): Promise<Page> {
    const at = this.now().toISOString();
    const existing = this.pages.get(imdbId);
    const page: Page = {
      imdbId,
      body,
      revisions: [...(existing?.revisions ?? []), { at, question, body }],
      updatedAt: at,
    };
    this.pages.set(imdbId, page);
    return page;
  }

  async snapshot(): Promise<BrainSnapshot> {
    return { nodes: [...this.nodes.values()], edges: [...this.edges.values()] };
  }

  async sessionNodes(sessionId: string): Promise<string[]> {
    return [...(this.sessions.get(sessionId) ?? [])];
  }

  async countQuestionsToday(): Promise<number> {
    const day = this.now().toISOString().slice(0, 10);
    return this.questions.filter((q) => q.at.slice(0, 10) === day).length;
  }

  async recordQuestion(input: { sessionId?: string; text: string }): Promise<void> {
    this.questions.push({ at: this.now().toISOString(), ...input });
  }

  /** No-op: embeddings need pgvector, which only the Postgres brain has. */
  async upsertEmbeddings(rows: { imdbId: string; embedding: number[] }[]): Promise<void> {
    void rows;
  }

  /** No-op: without pgvector there is nothing to search, so resolution falls back. */
  async semanticSearch(embedding: number[], limit: number): Promise<{ imdbId: string; distance: number }[]> {
    void embedding;
    void limit;
    return [];
  }
}
