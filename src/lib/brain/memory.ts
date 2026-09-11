import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Overlay, OverlayEdge } from "@/lib/graph/engine";
import type { Brain, BrainEdge, BrainNode, BrainNodeInput, BrainSnapshot, Page, StoredAnswer, StoredAnswerInput } from "./types";

interface Persisted {
  nodes: BrainNode[];
  edges: BrainEdge[];
  pages: Page[];
  sessions: Record<string, string[]>;
  questions: { at: string; sessionId?: string; text: string }[];
  answers?: StoredAnswer[];
}

/**
 * In-memory brain. Used by tests and by `pnpm dev` when DATABASE_URL is unset.
 * Pass `file` to persist to a JSON file (debounced) so dev restarts keep the brain.
 */
export class MemoryBrain implements Brain {
  private nodes = new Map<string, BrainNode>();
  private edges = new Map<string, BrainEdge>();
  private pages = new Map<string, Page>();
  private sessions = new Map<string, Set<string>>();
  private questions: { at: string; sessionId?: string; text: string }[] = [];
  private answers = new Map<string, StoredAnswer>();
  private now: () => Date;
  private file?: string;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: { now?: () => Date; file?: string } = {}) {
    this.now = opts.now ?? (() => new Date());
    this.file = opts.file;
    if (this.file && existsSync(this.file)) this.loadFile(this.file);
  }

  private loadFile(file: string) {
    try {
      const p = JSON.parse(readFileSync(file, "utf8")) as Persisted;
      for (const n of p.nodes ?? []) this.nodes.set(n.imdbId, n);
      for (const e of p.edges ?? []) this.edges.set(`${e.personImdbId}|${e.titleImdbId}`, e);
      for (const pg of p.pages ?? []) this.pages.set(pg.imdbId, pg);
      for (const [sid, ids] of Object.entries(p.sessions ?? {})) this.sessions.set(sid, new Set(ids));
      this.questions = p.questions ?? [];
      for (const a of p.answers ?? []) this.answers.set(a.cacheKey, a);
      console.log(`[brain] loaded ${this.nodes.size} nodes, ${this.edges.size} overlay edges, ${this.pages.size} pages from ${file}`);
    } catch (err) {
      console.warn(`[brain] could not read ${file}:`, err);
    }
  }

  /** Debounced write; `flush()` forces it. */
  private dirty() {
    if (!this.file) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 500);
  }

  flush(): void {
    if (!this.file) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    const data: Persisted = {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
      pages: [...this.pages.values()],
      sessions: Object.fromEntries([...this.sessions].map(([k, v]) => [k, [...v]])),
      questions: this.questions,
      answers: [...this.answers.values()],
    };
    mkdirSync(path.dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(data));
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
      this.dirty();
      if (sessionId) {
        let set = this.sessions.get(sessionId);
        if (!set) this.sessions.set(sessionId, (set = new Set()));
        set.add(n.imdbId);
      }
    }
  }

  async addEdges(edges: OverlayEdge[]): Promise<void> {
    for (const e of edges) this.edges.set(`${e.personImdbId}|${e.titleImdbId}`, { ...e, source: "overlay" });
    this.dirty();
  }

  async getNode(imdbId: string): Promise<BrainNode | null> {
    return this.nodes.get(imdbId) ?? null;
  }

  async updateNode(imdbId: string, patch: Partial<Pick<BrainNode, "tmdbId" | "posterUrl" | "knownAs">>): Promise<void> {
    const n = this.nodes.get(imdbId);
    if (n) {
      Object.assign(n, patch);
      this.dirty();
    }
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
    this.dirty();
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
    this.dirty();
  }

  async getAnswer(cacheKey: string): Promise<StoredAnswer | null> {
    return this.answers.get(cacheKey) ?? null;
  }

  async answerById(id: string): Promise<StoredAnswer | null> {
    for (const a of this.answers.values()) if (a.id === id) return a;
    return null;
  }

  async saveAnswer(input: StoredAnswerInput): Promise<StoredAnswer> {
    const answer: StoredAnswer = { ...input, createdAt: input.createdAt ?? this.now().toISOString() };
    this.answers.set(answer.cacheKey, answer);
    this.dirty();
    return answer;
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
