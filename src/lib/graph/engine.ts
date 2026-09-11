/**
 * The industry graph engine. Deterministic, in-process, no network, no model.
 *
 * Two inputs:
 *   - the packed industry graph (read-only, from the offline pipeline)
 *   - an optional overlay of live-discovered nodes and edges (from the brain)
 *
 * Internal node ids are integers. Ids below `packed.header.nodeCount` are
 * packed nodes; ids at or above it are overlay nodes. Callers outside this
 * module should address nodes by IMDb id and let the engine translate.
 */
import { TIER_STRONG, type NodeKind, type PackedGraph, type TitleType } from "./format";

export interface NodeInfo {
  id: number;
  imdbId: string;
  name: string;
  kind: NodeKind;
  titleType: TitleType | "";
  year: number;
  votes: number;
  genres: string;
  /** True if the node came from the overlay, not the packed graph. */
  overlay: boolean;
  /** TMDB id when the packed graph (format v2) knows it. */
  tmdbId?: number;
}

/** One credit on a title, with the character name when the packed graph has it (format v2). */
export interface CastEntry {
  node: NodeInfo;
  tier: number;
  character: string | null;
}

export interface OverlayNode {
  imdbId: string;
  name: string;
  kind: NodeKind;
  titleType?: TitleType | "";
  year?: number;
  votes?: number;
  genres?: string;
}

export interface OverlayEdge {
  personImdbId: string;
  titleImdbId: string;
  tier: number;
}

export interface Overlay {
  nodes: OverlayNode[];
  edges: OverlayEdge[];
}

export type Tier = "strong" | "all";

export interface PathSet {
  /** Which tier the search ran on. */
  tier: Tier;
  /** Distance in edges between the endpoints. */
  distance: number;
  /** Number of titles on the path. For person->person this is the Bacon number. */
  baconNumber: number;
  /** Tied shortest paths as node-id sequences, source first. Capped. */
  paths: number[][];
  /** True if more tied paths existed than were returned. */
  truncated: boolean;
}

export interface TieredPaths {
  /** Result on the strong tier only, or null if no path within maxDepth. */
  strong: PathSet | null;
  /** Result on the full graph (strong + weak + overlay), or null if disconnected. */
  full: PathSet | null;
  /** True when the strong-tier path is longer than the full-graph path. */
  differ: boolean;
}

export interface PathOptions {
  /** Maximum path length in edges. Default 12 (Bacon number 6). */
  maxDepth?: number;
  /** Maximum tied paths to enumerate. Default 20. */
  maxPaths?: number;
}

const DEFAULT_MAX_DEPTH = 12;
const DEFAULT_MAX_PATHS = 20;

export class IndustryGraph {
  private readonly packed: PackedGraph;
  private readonly baseCount: number;
  private readonly indexByImdb = new Map<string, number>();
  private readonly lowerNameIndex = new Map<string, number[]>();

  private overlayNodes: OverlayNode[] = [];
  /** overlay adjacency for every node (packed or overlay) that has overlay edges */
  private overlayAdj = new Map<number, { id: number; tier: number }[]>();

  constructor(packed: PackedGraph, overlay?: Overlay) {
    this.packed = packed;
    this.baseCount = packed.header.nodeCount;
    const ids = packed.header.nodes.imdbId;
    for (let i = 0; i < ids.length; i++) this.indexByImdb.set(ids[i], i);
    const names = packed.header.nodes.name;
    for (let i = 0; i < names.length; i++) this.addToNameIndex(names[i], i);
    if (overlay) this.applyOverlay(overlay);
  }

  get nodeCount(): number {
    return this.baseCount + this.overlayNodes.length;
  }

  get buildId(): string {
    return this.packed.header.buildId;
  }

  /** Replace the overlay wholesale (the brain hands over its current view). */
  setOverlay(overlay: Overlay): void {
    for (const n of this.overlayNodes) {
      this.indexByImdb.delete(n.imdbId);
      const key = n.name.toLowerCase();
      this.lowerNameIndex.delete(key);
    }
    this.overlayNodes = [];
    this.overlayAdj.clear();
    this.applyOverlay(overlay);
  }

  private applyOverlay(overlay: Overlay): void {
    for (const n of overlay.nodes) {
      if (this.indexByImdb.has(n.imdbId)) continue; // packed wins
      const id = this.baseCount + this.overlayNodes.length;
      this.overlayNodes.push(n);
      this.indexByImdb.set(n.imdbId, id);
      this.addToNameIndex(n.name, id);
    }
    for (const e of overlay.edges) {
      const p = this.indexByImdb.get(e.personImdbId);
      const t = this.indexByImdb.get(e.titleImdbId);
      if (p === undefined || t === undefined) continue;
      if (this.hasPackedEdge(p, t)) continue;
      this.pushOverlayEdge(p, t, e.tier);
      this.pushOverlayEdge(t, p, e.tier);
    }
  }

  private pushOverlayEdge(from: number, to: number, tier: number) {
    let list = this.overlayAdj.get(from);
    if (!list) {
      list = [];
      this.overlayAdj.set(from, list);
    }
    if (!list.some((x) => x.id === to)) list.push({ id: to, tier });
  }

  private hasPackedEdge(a: number, b: number): boolean {
    if (a >= this.baseCount || b >= this.baseCount) return false;
    const { offsets, neighbors } = this.packed;
    for (let k = offsets[a]; k < offsets[a + 1]; k++) if (neighbors[k] === b) return true;
    return false;
  }

  private addToNameIndex(name: string, id: number) {
    const key = name.toLowerCase();
    const list = this.lowerNameIndex.get(key);
    if (list) list.push(id);
    else this.lowerNameIndex.set(key, [id]);
  }

  // ---- node access -------------------------------------------------------

  idOf(imdbId: string): number | undefined {
    return this.indexByImdb.get(imdbId);
  }

  node(id: number): NodeInfo {
    if (id < this.baseCount) {
      const n = this.packed.header.nodes;
      return {
        id,
        imdbId: n.imdbId[id],
        name: n.name[id],
        kind: n.kind[id],
        titleType: n.titleType[id],
        year: n.year[id],
        votes: n.votes[id],
        genres: n.genres[id],
        overlay: false,
        tmdbId: n.tmdbId?.[id] || undefined,
      };
    }
    const o = this.overlayNodes[id - this.baseCount];
    if (!o) throw new Error(`No node ${id}`);
    return {
      id,
      imdbId: o.imdbId,
      name: o.name,
      kind: o.kind,
      titleType: o.titleType ?? "",
      year: o.year ?? 0,
      votes: o.votes ?? 0,
      genres: o.genres ?? "",
      overlay: true,
    };
  }

  nodeByImdbId(imdbId: string): NodeInfo | undefined {
    const id = this.indexByImdb.get(imdbId);
    return id === undefined ? undefined : this.node(id);
  }

  /** Neighbors of a node, filtered by tier. Packed edges first, then overlay. */
  neighbors(id: number, tier: Tier = "all"): { id: number; tier: number }[] {
    const out: { id: number; tier: number }[] = [];
    if (id < this.baseCount) {
      const { offsets, neighbors, tiers } = this.packed;
      for (let k = offsets[id]; k < offsets[id + 1]; k++) {
        if (tier === "strong" && tiers[k] !== TIER_STRONG) continue;
        out.push({ id: neighbors[k], tier: tiers[k] });
      }
    }
    const extra = this.overlayAdj.get(id);
    if (extra) for (const e of extra) if (tier === "all" || e.tier === TIER_STRONG) out.push(e);
    return out;
  }

  degree(id: number): number {
    return this.neighbors(id).length;
  }

  /**
   * Character name for a (person, title) credit from the packed character
   * table (format v2), or null when unknown / v1 file / overlay edge.
   * Binary search over the person's neighbor list, which the pipeline sorts
   * by node id, so this is O(log degree).
   */
  character(personId: number, titleId: number): string | null {
    const { chars, offsets, neighbors, header } = this.packed;
    const table = header.characters;
    if (!chars || !table) return null;
    if (personId >= this.baseCount || titleId >= this.baseCount) return null;
    let lo = offsets[personId];
    let hi = offsets[personId + 1] - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = neighbors[mid];
      if (v === titleId) return table[chars[mid]] || null;
      if (v < titleId) lo = mid + 1;
      else hi = mid - 1;
    }
    return null;
  }

  /** Everyone credited on a title (or a person's titles), most prominent first, with characters. */
  castOf(id: number): CastEntry[] {
    const self = this.node(id);
    return this.neighbors(id)
      .map((n) => {
        const node = this.node(n.id);
        const personId = node.kind === "person" ? n.id : id;
        const titleId = node.kind === "person" ? id : n.id;
        return { node, tier: n.tier, character: self.kind === node.kind ? null : this.character(personId, titleId) };
      })
      .sort((a, b) => b.node.votes - a.node.votes || a.node.id - b.node.id);
  }

  // ---- name lookup -------------------------------------------------------

  /**
   * Exact (case-insensitive) name match, then prefix / substring match.
   * Results ranked by votes so famous entities come first. Cheap and dumb on
   * purpose: fuzzy resolution is the agent's job, this is its first tool.
   */
  searchByName(query: string, limit = 10, kind?: NodeKind): NodeInfo[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<number>();
    const exact = (this.lowerNameIndex.get(q) ?? []).map((id) => this.node(id));
    for (const n of exact) seen.add(n.id);
    const rest: NodeInfo[] = [];
    if (exact.length < limit) {
      for (const [name, ids] of this.lowerNameIndex) {
        if (!name.includes(q)) continue;
        for (const id of ids) {
          if (seen.has(id)) continue;
          seen.add(id);
          rest.push(this.node(id));
        }
      }
      rest.sort((a, b) => b.votes - a.votes || (a.name < b.name ? -1 : 1));
    }
    return [...exact, ...rest].filter((n) => !kind || n.kind === kind).slice(0, limit);
  }

  // ---- graph operations --------------------------------------------------

  /**
   * Tiered shortest paths. Runs the strong tier first, then the full graph.
   * Bacon number is always the full-graph distance; the strong result is the
   * "interesting" route when it differs.
   */
  tieredPaths(source: number, target: number, opts: PathOptions = {}): TieredPaths {
    const strong = this.shortestPaths(source, target, "strong", opts);
    const full = this.shortestPaths(source, target, "all", opts);
    const differ = !!strong && !!full && strong.distance !== full.distance;
    return { strong, full, differ };
  }

  /** All tied shortest paths between two nodes on one tier, capped. */
  shortestPaths(source: number, target: number, tier: Tier, opts: PathOptions = {}): PathSet | null {
    const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
    const maxPaths = opts.maxPaths ?? DEFAULT_MAX_PATHS;
    if (source === target) {
      return { tier, distance: 0, baconNumber: 0, paths: [[source]], truncated: false };
    }
    const distS = this.bfs(source, tier, maxDepth);
    const d = distS[target];
    if (d < 0) return null;
    const distT = this.bfs(target, tier, d);

    // Enumerate: walk from source along nodes with distS(v) == depth and
    // distT(v) == d - depth. Every such walk is a shortest path.
    const paths: number[][] = [];
    let truncated = false;
    const stack: number[] = [source];
    const dfs = (v: number, depth: number): boolean => {
      if (v === target) {
        paths.push([...stack]);
        return paths.length < maxPaths;
      }
      for (const n of this.neighbors(v, tier)) {
        if (distS[n.id] !== depth + 1 || distT[n.id] !== d - depth - 1) continue;
        stack.push(n.id);
        const keepGoing = dfs(n.id, depth + 1);
        stack.pop();
        if (!keepGoing) {
          truncated = true;
          return false;
        }
      }
      return true;
    };
    dfs(source, 0);
    return { tier, distance: d, baconNumber: this.titlesOnPath(paths[0]), paths, truncated };
  }

  private titlesOnPath(path: number[]): number {
    let n = 0;
    for (const id of path) if (this.node(id).kind === "title") n++;
    return n;
  }

  /** Breadth-first distances from `start`, -1 for unreached, bounded by maxDepth. */
  private bfs(start: number, tier: Tier, maxDepth: number): Int32Array {
    const dist = new Int32Array(this.nodeCount).fill(-1);
    dist[start] = 0;
    let frontier = [start];
    for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
      const next: number[] = [];
      for (const v of frontier) {
        for (const n of this.neighbors(v, tier)) {
          if (dist[n.id] >= 0) continue;
          dist[n.id] = depth + 1;
          next.push(n.id);
        }
      }
      frontier = next;
    }
    return dist;
  }

  /** Nodes adjacent to both a and b (people shared by two titles, or titles shared by two people). */
  commonNeighbors(a: number, b: number, tier: Tier = "all"): NodeInfo[] {
    const setA = new Set(this.neighbors(a, tier).map((n) => n.id));
    const out: NodeInfo[] = [];
    for (const n of this.neighbors(b, tier)) if (setA.has(n.id)) out.push(this.node(n.id));
    out.sort((x, y) => y.votes - x.votes || (x.name < y.name ? -1 : 1));
    return out;
  }

  /** Titles two people share. Alias of commonNeighbors with a person-shaped name. */
  sharedCredits(personA: number, personB: number): NodeInfo[] {
    return this.commonNeighbors(personA, personB).filter((n) => n.kind === "title");
  }

  /** Full neighborhood of a node with metadata, sorted by votes. */
  neighborhood(id: number, limit = 50): { node: NodeInfo; tier: number }[] {
    return this.neighbors(id)
      .map((n) => ({ node: this.node(n.id), tier: n.tier }))
      .sort((x, y) => y.node.votes - x.node.votes || (x.node.name < y.node.name ? -1 : 1))
      .slice(0, limit);
  }
}
