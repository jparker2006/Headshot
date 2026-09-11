/**
 * Packed industry graph: the on-disk / in-memory format shared by the offline
 * pipeline (scripts/build-graph) and the runtime engine (src/lib/graph).
 *
 * The graph is an undirected bipartite graph: people <-> titles. Every edge is
 * a credit and carries a tier bit (1 = strong, 0 = weak). Adjacency is stored
 * CSR-style with both directions materialized so BFS never needs to know
 * which side a node is on.
 *
 * Container layout (little-endian):
 *   magic "HDSH" (4 bytes) | version u32 | headerLen u32 | header JSON (utf8)
 *   | offsets  u32[nodeCount + 1]
 *   | neighbors u32[edgeCount * 2]
 *   | tiers     u8 [edgeCount * 2]
 */

export const FORMAT_MAGIC = "HDSH";
export const FORMAT_VERSION = 1;

export type NodeKind = "person" | "title";
export type TitleType = "movie" | "tvSeries" | "tvMiniSeries" | "tvMovie";

export const TIER_WEAK = 0;
export const TIER_STRONG = 1;

export interface GraphHeader {
  /** Build identifier, e.g. an ISO date. */
  buildId: string;
  nodeCount: number;
  /** Undirected edge count (each stored twice in `neighbors`). */
  edgeCount: number;
  /** Parallel arrays indexed by node id. */
  nodes: {
    /** IMDb id: "nm…" for people, "tt…" for titles. */
    imdbId: string[];
    name: string[];
    kind: NodeKind[];
    /** Title type for titles, "" for people. */
    titleType: (TitleType | "")[];
    /** Start year, 0 if unknown. */
    year: number[];
    /** IMDb vote count for titles; for people, the max votes among their kept titles. */
    votes: number[];
    /** Comma-separated genres for titles, "" for people. */
    genres: string[];
  };
}

export interface PackedGraph {
  header: GraphHeader;
  offsets: Uint32Array;
  neighbors: Uint32Array;
  tiers: Uint8Array;
}

export function encodeGraph(g: PackedGraph): Uint8Array {
  const headerBytes = new TextEncoder().encode(JSON.stringify(g.header));
  const prefix = 4 + 4 + 4;
  const headerEnd = prefix + headerBytes.byteLength;
  const offsetsStart = align4(headerEnd);
  const neighborsStart = offsetsStart + g.offsets.byteLength;
  const tiersStart = neighborsStart + g.neighbors.byteLength;
  const total = tiersStart + g.tiers.byteLength;

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set(new TextEncoder().encode(FORMAT_MAGIC), 0);
  view.setUint32(4, FORMAT_VERSION, true);
  view.setUint32(8, headerBytes.byteLength, true);
  out.set(headerBytes, prefix);
  out.set(new Uint8Array(g.offsets.buffer, g.offsets.byteOffset, g.offsets.byteLength), offsetsStart);
  out.set(new Uint8Array(g.neighbors.buffer, g.neighbors.byteOffset, g.neighbors.byteLength), neighborsStart);
  out.set(g.tiers, tiersStart);
  return out;
}

export function decodeGraph(bytes: Uint8Array): PackedGraph {
  const magic = new TextDecoder().decode(bytes.subarray(0, 4));
  if (magic !== FORMAT_MAGIC) throw new Error(`Not a Headshot graph (magic ${JSON.stringify(magic)})`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(4, true);
  if (version !== FORMAT_VERSION) throw new Error(`Unsupported graph format version ${version}`);
  const headerLen = view.getUint32(8, true);
  const prefix = 12;
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(prefix, prefix + headerLen))) as GraphHeader;

  const offsetsStart = align4(prefix + headerLen);
  const offsetsLen = header.nodeCount + 1;
  const neighborsStart = offsetsStart + offsetsLen * 4;
  const neighborsLen = header.edgeCount * 2;
  const tiersStart = neighborsStart + neighborsLen * 4;

  // Copy into fresh aligned buffers so callers never depend on the source buffer's alignment.
  const offsets = new Uint32Array(offsetsLen);
  new Uint8Array(offsets.buffer).set(bytes.subarray(offsetsStart, offsetsStart + offsetsLen * 4));
  const neighbors = new Uint32Array(neighborsLen);
  new Uint8Array(neighbors.buffer).set(bytes.subarray(neighborsStart, neighborsStart + neighborsLen * 4));
  const tiers = bytes.slice(tiersStart, tiersStart + neighborsLen);

  return { header, offsets, neighbors, tiers };
}

function align4(n: number): number {
  return (n + 3) & ~3;
}
