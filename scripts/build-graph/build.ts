import { existsSync } from "node:fs";
import path from "node:path";
import { readTsv, NULL } from "./tsv";
import {
  TIER_STRONG,
  TIER_WEAK,
  type GraphHeader,
  type NodeKind,
  type PackedGraph,
  type TitleType,
} from "../../src/lib/graph/format";

export interface BuildOptions {
  /** Directory holding the IMDb TSVs (gzipped or not). */
  inputDir: string;
  /** Minimum IMDb votes for a title to exist in the graph. */
  voteFloor: number;
  buildId: string;
  log?: (msg: string) => void;
}

export const DEFAULT_VOTE_FLOOR = 1000;

const KEPT_TITLE_TYPES = new Set<TitleType>(["movie", "tvSeries", "tvMiniSeries", "tvMovie"]);
const KEPT_CATEGORIES = new Set(["actor", "actress", "director", "writer"]);
/** Genres that push every edge on the title into the weak tier. */
const WEAK_GENRES = new Set(["Talk-Show", "Reality-TV", "News", "Game-Show"]);
/** Series with more episodes than this are weak (guest-star soup). */
export const MAX_STRONG_EPISODES = 200;

interface TitleRow {
  type: TitleType;
  name: string;
  year: number;
  genres: string;
}

/**
 * Locate a dataset file in inputDir, accepting either the gzipped download
 * name or a plain .tsv (fixtures).
 */
function datasetPath(inputDir: string, base: string): string {
  for (const candidate of [`${base}.tsv.gz`, `${base}.tsv`]) {
    const p = path.join(inputDir, candidate);
    if (existsSync(p)) return p;
  }
  throw new Error(`Missing dataset ${base}.tsv(.gz) in ${inputDir}`);
}

/**
 * Build the packed industry graph from IMDb datasets. Pure with respect to
 * the filesystem inputs: same TSVs in, same graph out.
 */
export async function buildGraph(opts: BuildOptions): Promise<PackedGraph> {
  const log = opts.log ?? (() => {});
  const { inputDir, voteFloor } = opts;

  // 1. Ratings: which tconsts clear the vote floor.
  const votes = new Map<string, number>();
  for await (const [tconst, , numVotes] of readTsv(datasetPath(inputDir, "title.ratings"))) {
    const n = Number(numVotes);
    if (n >= voteFloor) votes.set(tconst, n);
  }
  log(`ratings: ${votes.size} titles clear the ${voteFloor}-vote floor`);

  // 2. Basics: keep allowed types among those titles.
  const titles = new Map<string, TitleRow>();
  for await (const row of readTsv(datasetPath(inputDir, "title.basics"))) {
    const [tconst, titleType, primaryTitle, , , startYear, , , genres] = row;
    if (!votes.has(tconst)) continue;
    if (!KEPT_TITLE_TYPES.has(titleType as TitleType)) continue;
    titles.set(tconst, {
      type: titleType as TitleType,
      name: primaryTitle,
      year: startYear === NULL ? 0 : Number(startYear),
      genres: genres === NULL ? "" : genres,
    });
  }
  log(`basics: ${titles.size} titles kept`);

  // 3. Episodes: count per parent series so long-runners can be demoted to weak.
  const episodeCounts = new Map<string, number>();
  const episodePath = safeDatasetPath(inputDir, "title.episode");
  if (episodePath) {
    for await (const [, parentTconst] of readTsv(episodePath)) {
      if (!titles.has(parentTconst)) continue;
      episodeCounts.set(parentTconst, (episodeCounts.get(parentTconst) ?? 0) + 1);
    }
  }

  // Decide the tier every edge on a title gets.
  const titleTier = new Map<string, number>();
  for (const [tconst, t] of titles) {
    let tier = TIER_STRONG;
    if (t.genres.split(",").some((g) => WEAK_GENRES.has(g))) tier = TIER_WEAK;
    if (t.type === "tvSeries" && (episodeCounts.get(tconst) ?? 0) > MAX_STRONG_EPISODES) tier = TIER_WEAK;
    titleTier.set(tconst, tier);
  }

  // 4. Principals: credits on kept titles in kept categories.
  //    Edge set is deduped per (person, title); tier is the title's tier.
  const edgesByPerson = new Map<string, Set<string>>();
  for await (const [tconst, , nconst, category] of readTsv(datasetPath(inputDir, "title.principals"))) {
    if (!titles.has(tconst)) continue;
    if (!KEPT_CATEGORIES.has(category)) continue;
    let set = edgesByPerson.get(nconst);
    if (!set) {
      set = new Set();
      edgesByPerson.set(nconst, set);
    }
    set.add(tconst);
  }
  log(`principals: ${edgesByPerson.size} people with credits`);

  // 5. Names for kept people.
  const personNames = new Map<string, { name: string; year: number }>();
  for await (const [nconst, primaryName, birthYear] of readTsv(datasetPath(inputDir, "name.basics"))) {
    if (!edgesByPerson.has(nconst)) continue;
    personNames.set(nconst, { name: primaryName, year: birthYear === NULL ? 0 : Number(birthYear) });
  }

  // 6. Assign node ids: titles first (sorted by votes desc, then id), then people
  //    (sorted by name for determinism). Titles that ended up with zero credits
  //    are dropped so every node in the graph has at least one edge.
  const usedTitles = new Set<string>();
  for (const set of edgesByPerson.values()) for (const t of set) usedTitles.add(t);

  const titleIds = [...usedTitles].sort((a, b) => votes.get(b)! - votes.get(a)! || (a < b ? -1 : 1));
  const personIds = [...edgesByPerson.keys()].sort((a, b) => {
    const na = personNames.get(a)?.name ?? a;
    const nb = personNames.get(b)?.name ?? b;
    return na < nb ? -1 : na > nb ? 1 : a < b ? -1 : 1;
  });

  const nodeIndex = new Map<string, number>();
  const nodes: GraphHeader["nodes"] = {
    imdbId: [],
    name: [],
    kind: [],
    titleType: [],
    year: [],
    votes: [],
    genres: [],
  };
  const push = (
    imdbId: string,
    name: string,
    kind: NodeKind,
    titleType: TitleType | "",
    year: number,
    v: number,
    genres: string,
  ) => {
    nodeIndex.set(imdbId, nodes.imdbId.length);
    nodes.imdbId.push(imdbId);
    nodes.name.push(name);
    nodes.kind.push(kind);
    nodes.titleType.push(titleType);
    nodes.year.push(year);
    nodes.votes.push(v);
    nodes.genres.push(genres);
  };
  for (const tconst of titleIds) {
    const t = titles.get(tconst)!;
    push(tconst, t.name, "title", t.type, t.year, votes.get(tconst)!, t.genres);
  }
  for (const nconst of personIds) {
    const p = personNames.get(nconst) ?? { name: nconst, year: 0 };
    let maxVotes = 0;
    for (const t of edgesByPerson.get(nconst)!) maxVotes = Math.max(maxVotes, votes.get(t)!);
    push(nconst, p.name, "person", "", p.year, maxVotes, "");
  }

  // 7. CSR with both directions. Neighbor lists sorted by node id for determinism.
  const nodeCount = nodes.imdbId.length;
  const adj: number[][] = Array.from({ length: nodeCount }, () => []);
  const adjTier: number[][] = Array.from({ length: nodeCount }, () => []);
  let edgeCount = 0;
  for (const [nconst, set] of edgesByPerson) {
    const p = nodeIndex.get(nconst)!;
    for (const tconst of set) {
      const t = nodeIndex.get(tconst)!;
      const tier = titleTier.get(tconst)!;
      adj[p].push(t);
      adjTier[p].push(tier);
      adj[t].push(p);
      adjTier[t].push(tier);
      edgeCount++;
    }
  }
  const offsets = new Uint32Array(nodeCount + 1);
  const neighbors = new Uint32Array(edgeCount * 2);
  const tiers = new Uint8Array(edgeCount * 2);
  let cursor = 0;
  for (let i = 0; i < nodeCount; i++) {
    offsets[i] = cursor;
    const order = adj[i].map((_, k) => k).sort((a, b) => adj[i][a] - adj[i][b]);
    for (const k of order) {
      neighbors[cursor] = adj[i][k];
      tiers[cursor] = adjTier[i][k];
      cursor++;
    }
  }
  offsets[nodeCount] = cursor;
  log(`packed: ${nodeCount} nodes, ${edgeCount} edges`);

  return {
    header: { buildId: opts.buildId, nodeCount, edgeCount, nodes },
    offsets,
    neighbors,
    tiers,
  };
}

function safeDatasetPath(inputDir: string, base: string): string | null {
  try {
    return datasetPath(inputDir, base);
  } catch {
    return null;
  }
}
