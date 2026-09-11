"use client";
/**
 * Client-side model of the brain for the canvas: a graphology graph plus
 * highlight state. Fed by the /api/brain snapshot and by live agent events.
 * Consumed through useSyncExternalStore.
 */
import Graph from "graphology";
import type { HeadshotDataParts, CanvasNode, CanvasEdge } from "@/lib/agent/events";
import type { RenderedBrain } from "@/lib/brain/render";

export interface NodeAttrs {
  label: string;
  kind: "person" | "title";
  titleType: string;
  year: number;
  votes: number;
  inIndustryGraph: boolean;
  x: number;
  y: number;
  size: number;
  color: string;
}
export interface EdgeAttrs {
  tier: number;
  source: "packed" | "overlay";
  size: number;
  color: string;
}

export interface Highlight {
  /** The chosen path: nodes and edge keys lit brightly, revealed hop by hop. */
  pathNodes: Set<string>;
  pathEdges: Set<string>;
  /** Every tied path, drawn faintly. */
  altNodes: Set<string>;
  altEdges: Set<string>;
  /** Candidates the agent is deciding between. */
  candidates: Set<string>;
  focus: string[];
}

export interface BrainState {
  version: number;
  nodeCount: number;
  edgeCount: number;
  sessionIds: Set<string>;
  highlight: Highlight;
  status: string | null;
  loaded: boolean;
}

export const COLORS = {
  person: "#ded9c9",
  title: "#7d8cc4",
  accent: "#f4b63f",
  session: "#62e6b4",
  edge: "rgba(255,255,255,0.10)",
  edgeWeak: "rgba(255,255,255,0.05)",
  edgeOverlay: "rgba(98,230,180,0.28)",
};

export const edgeKey = (personImdbId: string, titleImdbId: string) => `${personImdbId}|${titleImdbId}`;

const emptyHighlight = (): Highlight => ({
  pathNodes: new Set(),
  pathEdges: new Set(),
  altNodes: new Set(),
  altEdges: new Set(),
  candidates: new Set(),
  focus: [],
});

export class BrainStore {
  readonly graph = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected", multi: false });
  private listeners = new Set<() => void>();
  private state: BrainState = {
    version: 0,
    nodeCount: 0,
    edgeCount: 0,
    sessionIds: new Set(),
    highlight: emptyHighlight(),
    status: null,
    loaded: false,
  };
  private hopTimers: ReturnType<typeof setTimeout>[] = [];

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.state;

  private bump(patch: Partial<BrainState> = {}) {
    this.state = {
      ...this.state,
      ...patch,
      version: this.state.version + 1,
      nodeCount: this.graph.order,
      edgeCount: this.graph.size,
    };
    for (const fn of this.listeners) fn();
  }

  /** Replace contents from a server snapshot, keeping positions of nodes we already have. */
  load(r: RenderedBrain) {
    for (const n of r.nodes) this.ensureNode(n);
    for (const e of r.edges) this.ensureEdge(e.personImdbId, e.titleImdbId, e.tier, e.source);
    this.resize();
    this.bump({ sessionIds: new Set([...this.state.sessionIds, ...r.sessionNodeIds]), loaded: true });
  }

  private ensureNode(n: CanvasNode | RenderedBrain["nodes"][number], mine = false) {
    if (this.graph.hasNode(n.imdbId)) return;
    const pos = this.place();
    this.graph.addNode(n.imdbId, {
      label: n.name,
      kind: n.kind,
      titleType: n.titleType,
      year: n.year,
      votes: n.votes,
      inIndustryGraph: n.inIndustryGraph,
      x: pos.x,
      y: pos.y,
      size: 3,
      color: n.kind === "person" ? COLORS.person : COLORS.title,
    });
    if (mine) this.state.sessionIds.add(n.imdbId);
  }

  private ensureEdge(person: string, title: string, tier: number, source: "packed" | "overlay") {
    if (!this.graph.hasNode(person) || !this.graph.hasNode(title)) return;
    if (this.graph.hasEdge(person, title)) return;
    // Pull a freshly placed node toward its first neighbor so clusters form.
    const p = this.graph.getNodeAttributes(person);
    const t = this.graph.getNodeAttributes(title);
    if (this.graph.degree(person) === 0 && this.graph.degree(title) > 0) this.nudge(person, t);
    else if (this.graph.degree(title) === 0 && this.graph.degree(person) > 0) this.nudge(title, p);
    this.graph.addEdgeWithKey(edgeKey(person, title), person, title, {
      tier,
      source,
      size: source === "overlay" ? 1.2 : tier === 1 ? 0.8 : 0.5,
      color: source === "overlay" ? COLORS.edgeOverlay : tier === 1 ? COLORS.edge : COLORS.edgeWeak,
    });
  }

  private nudge(node: string, near: { x: number; y: number }) {
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 8;
    this.graph.mergeNodeAttributes(node, { x: near.x + Math.cos(a) * r, y: near.y + Math.sin(a) * r });
  }

  private place() {
    const n = this.graph.order;
    const r = 20 + Math.sqrt(n) * 6 * Math.random();
    const a = Math.random() * Math.PI * 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }

  private resize() {
    this.graph.forEachNode((node) => {
      const d = this.graph.degree(node);
      this.graph.setNodeAttribute(node, "size", 2.5 + Math.log2(d + 1) * 1.6);
    });
  }

  // ---- live agent events ----

  apply<K extends keyof HeadshotDataParts>(type: K, data: HeadshotDataParts[K]) {
    switch (type) {
      case "node": {
        const n = data as CanvasNode;
        const isNew = !this.graph.hasNode(n.imdbId);
        this.ensureNode(n, isNew);
        this.resize();
        this.bump();
        return;
      }
      case "edge": {
        const e = data as CanvasEdge;
        this.ensureEdge(e.personImdbId, e.titleImdbId, e.tier, "overlay");
        this.resize();
        this.bump();
        return;
      }
      case "candidates": {
        const d = data as HeadshotDataParts["candidates"];
        for (const c of d.candidates) this.ensureNode(c);
        this.bump({ highlight: { ...this.state.highlight, candidates: new Set(d.candidates.map((c) => c.imdbId)) }, status: `Resolving "${d.query}"` });
        return;
      }
      case "paths": {
        const d = data as HeadshotDataParts["paths"];
        this.clearHopTimers();
        const altNodes = new Set<string>();
        const altEdges = new Set<string>();
        for (const set of [d.strong, d.full]) {
          for (const p of set?.paths ?? []) {
            for (let i = 0; i < p.imdbIds.length; i++) {
              altNodes.add(p.imdbIds[i]);
              if (i + 1 < p.imdbIds.length) altEdges.add(pairKey(p.imdbIds[i], p.imdbIds[i + 1]));
            }
          }
        }
        this.bump({
          highlight: { ...emptyHighlight(), altNodes, altEdges, focus: [...altNodes] },
          status: d.baconNumber === null ? "No connection found" : `${d.full?.paths.length ?? 0} tied paths at Bacon number ${d.baconNumber}`,
        });
        return;
      }
      case "path-hop": {
        const h = data as HeadshotDataParts["path-hop"];
        const t = setTimeout(() => {
          const hl = this.state.highlight;
          const pathNodes = new Set(hl.pathNodes).add(h.from).add(h.to);
          const pathEdges = new Set(hl.pathEdges).add(pairKey(h.from, h.to));
          this.bump({ highlight: { ...hl, pathNodes, pathEdges }, status: h.via ? `→ ${h.via}` : null });
        }, 380 * h.index);
        this.hopTimers.push(t);
        return;
      }
      case "focus": {
        const d = data as HeadshotDataParts["focus"];
        const delay = 380 * this.state.highlight.pathEdges.size;
        const t = setTimeout(() => this.bump({ highlight: { ...this.state.highlight, focus: d.imdbIds, candidates: new Set() } }), delay);
        this.hopTimers.push(t);
        return;
      }
      case "status": {
        this.bump({ status: (data as HeadshotDataParts["status"]).text });
        return;
      }
      case "page": {
        this.bump({ status: "Wrote a page" });
        return;
      }
    }
  }

  setFocus(imdbIds: string[]) {
    this.bump({ highlight: { ...this.state.highlight, focus: imdbIds } });
  }

  clearHighlight() {
    this.clearHopTimers();
    this.bump({ highlight: emptyHighlight(), status: null });
  }

  setStatus(status: string | null) {
    this.bump({ status });
  }

  private clearHopTimers() {
    for (const t of this.hopTimers) clearTimeout(t);
    this.hopTimers = [];
  }
}

/** Edge key regardless of which end is the person. */
export function pairKey(a: string, b: string): string {
  return a.startsWith("nm") ? edgeKey(a, b) : edgeKey(b, a);
}
