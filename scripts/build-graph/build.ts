import { existsSync } from "node:fs";
import path from "node:path";
import { readTsv, NULL } from "./tsv";
import type { CachedCredits } from "./tmdb";
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
  /**
   * Crawled TMDB credits keyed by IMDb title id (stage two). Pure input: the
   * crawl itself happens in index.ts and is handed in here.
   */
  tmdb?: Map<string, CachedCredits>;
  log?: (msg: string) => void;
}

export const DEFAULT_VOTE_FLOOR = 1000;

const KEPT_TITLE_TYPES = new Set<TitleType>(["movie", "tvSeries", "tvMiniSeries", "tvMovie"]);
const KEPT_CATEGORIES = new Set(["actor", "actress", "director", "writer"]);
/** Genres that push every edge on the title into the weak tier. */
const WEAK_GENRES = new Set(["Talk-Show", "Reality-TV", "News", "Game-Show"]);
/** Series with more episodes than this are weak (guest-star soup). */
export const MAX_STRONG_EPISODES = 200;
/** Cast members kept per crawled title (mirrors the crawl's cap). */
export const TMDB_CAST_CAP = 40;

interface TitleRow {
  type: TitleType;
  name: string;
  year: number;
  genres: string;
}

/** Everything the IMDb stage produces, before packing. */
export interface ImdbStage {
  /** Votes for every title clearing the floor. */
  votes: Map<string, number>;
  /** Kept titles (allowed type, above the floor). */
  titles: Map<string, TitleRow>;
  /** Tier every IMDb credit on a title gets. */
  titleTier: Map<string, number>;
  /** nconst → set of tconsts credited. */
  edgesByPerson: Map<string, Set<string>>;
  /** nconst → name.basics row, for people with credits. */
  personNames: Map<string, { name: string; year: number }>;
  /** Titles that actually ended up with at least one credit. */
  usedTitles: Set<string>;
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
 * Stage one: read the IMDb datasets into the intermediate maps. Pure with
 * respect to the filesystem inputs: same TSVs in, same stage out.
 */
export async function loadImdb(opts: Pick<BuildOptions, "inputDir" | "voteFloor" | "log">): Promise<ImdbStage> {
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

  // Titles with zero credits are dropped so every node in the graph has an edge.
  const usedTitles = new Set<string>();
  for (const set of edgesByPerson.values()) for (const t of set) usedTitles.add(t);

  return { votes, titles, titleTier, edgesByPerson, personNames, usedTitles };
}

/**
 * The titles worth crawling for full casts: the top `limit` by IMDb votes
 * among titles that made the graph, skipping weak-genre formats (talk shows
 * and the like) whose casts are noise.
 */
export function topTitlesForCrawl(stage: ImdbStage, limit: number): { imdbId: string; titleType: string }[] {
  const eligible: string[] = [];
  for (const tconst of stage.usedTitles) {
    const t = stage.titles.get(tconst);
    if (!t) continue;
    if (t.genres.split(",").some((g) => WEAK_GENRES.has(g))) continue;
    eligible.push(tconst);
  }
  eligible.sort((a, b) => stage.votes.get(b)! - stage.votes.get(a)! || (a < b ? -1 : 1));
  return eligible.slice(0, limit).map((tconst) => ({ imdbId: tconst, titleType: stage.titles.get(tconst)!.type }));
}

/**
 * Per title, the lowercased names of everyone already adjacent to it in the
 * IMDb graph. The crawl uses this to resolve those cast members without an
 * /external_ids call.
 */
export function knownPeopleByTitle(stage: ImdbStage): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const [nconst, set] of stage.edgesByPerson) {
    const name = (stage.personNames.get(nconst)?.name ?? "").toLowerCase();
    if (!name) continue;
    for (const tconst of set) {
      let m = out.get(tconst);
      if (!m) {
        m = new Map();
        out.set(tconst, m);
      }
      if (!m.has(name)) m.set(name, nconst);
    }
  }
  return out;
}

/**
 * Stage two: merge the optional TMDB crawl and pack everything into the
 * binary graph.
 */
export function pack(stage: ImdbStage, opts: Pick<BuildOptions, "buildId" | "tmdb" | "log">): PackedGraph {
  const log = opts.log ?? (() => {});
  const { votes, titles, titleTier, edgesByPerson, personNames, usedTitles } = stage;

  // Working edge set: nconst → tconst → tier. Starts as the IMDb credits.
  const edges = new Map<string, Map<string, number>>();
  for (const [nconst, set] of edgesByPerson) {
    const m = new Map<string, number>();
    for (const tconst of set) m.set(tconst, titleTier.get(tconst)!);
    edges.set(nconst, m);
  }
  const names = new Map(personNames);

  // ---- TMDB merge --------------------------------------------------------
  const useTmdb = !!opts.tmdb;
  const tmdbIdOf = new Map<string, number>();
  /** `${nconst}|${tconst}` → character name. */
  const characterOf = new Map<string, string>();
  if (opts.tmdb) {
    let mergedTitles = 0;
    let addedPeople = 0;
    let addedEdges = 0;
    let charactersSet = 0;
    // Sorted so the merge is deterministic regardless of crawl order.
    for (const tconst of [...opts.tmdb.keys()].sort()) {
      if (!usedTitles.has(tconst)) continue;
      const credits = opts.tmdb.get(tconst)!;
      mergedTitles++;
      tmdbIdOf.set(tconst, credits.tmdbId);
      for (const c of credits.cast.slice(0, TMDB_CAST_CAP)) {
        // Resolve the person: existing node by IMDb id, a new node with that
        // IMDb id, or a TMDB-only node when TMDB has no IMDb id for them.
        const nconst = c.imdbId ?? `tm${c.tmdbId}`;
        let m = edges.get(nconst);
        if (!m) {
          m = new Map();
          edges.set(nconst, m);
          names.set(nconst, { name: c.name, year: 0 });
          addedPeople++;
        }
        if (!m.has(tconst)) {
          // Full casts include guest and recurring credits: weak tier.
          m.set(tconst, TIER_WEAK);
          addedEdges++;
        }
        tmdbIdOf.set(nconst, c.tmdbId);
        if (c.character) {
          characterOf.set(`${nconst}|${tconst}`, c.character);
          charactersSet++;
        }
      }
    }
    log(
      `tmdb merge: ${mergedTitles} titles, ${addedPeople} new people, ${addedEdges} new edges, ${charactersSet} characters`,
    );
  }

  // ---- node ids ----------------------------------------------------------
  // Titles first (votes desc, then id), then people (by name). New people from
  // the crawl are interleaved into the same name sort, never appended.
  const titleIds = [...usedTitles].sort((a, b) => votes.get(b)! - votes.get(a)! || (a < b ? -1 : 1));
  const personIds = [...edges.keys()].sort((a, b) => {
    const na = names.get(a)?.name ?? a;
    const nb = names.get(b)?.name ?? b;
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
  if (useTmdb) nodes.tmdbId = [];
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
    nodes.tmdbId?.push(tmdbIdOf.get(imdbId) ?? 0);
  };
  for (const tconst of titleIds) {
    const t = titles.get(tconst)!;
    push(tconst, t.name, "title", t.type, t.year, votes.get(tconst)!, t.genres);
  }
  for (const nconst of personIds) {
    const p = names.get(nconst) ?? { name: nconst, year: 0 };
    let maxVotes = 0;
    for (const t of edges.get(nconst)!.keys()) maxVotes = Math.max(maxVotes, votes.get(t)!);
    push(nconst, p.name, "person", "", p.year, maxVotes, "");
  }

  // ---- CSR with both directions, neighbor lists sorted by node id --------
  const nodeCount = nodes.imdbId.length;
  const adj: number[][] = Array.from({ length: nodeCount }, () => []);
  const adjTier: number[][] = Array.from({ length: nodeCount }, () => []);
  const adjChar: number[][] = Array.from({ length: nodeCount }, () => []);
  const characters: string[] = [""];
  const charIndex = new Map<string, number>([["", 0]]);
  let edgeCount = 0;
  for (const [nconst, m] of edges) {
    const p = nodeIndex.get(nconst)!;
    for (const [tconst, tier] of m) {
      const t = nodeIndex.get(tconst)!;
      let ci = 0;
      if (useTmdb) {
        const character = characterOf.get(`${nconst}|${tconst}`) ?? "";
        ci = charIndex.get(character) ?? -1;
        if (ci < 0) {
          ci = characters.length;
          characters.push(character);
          charIndex.set(character, ci);
        }
      }
      adj[p].push(t);
      adjTier[p].push(tier);
      adjChar[p].push(ci);
      adj[t].push(p);
      adjTier[t].push(tier);
      adjChar[t].push(ci);
      edgeCount++;
    }
  }
  const offsets = new Uint32Array(nodeCount + 1);
  const neighbors = new Uint32Array(edgeCount * 2);
  const tiers = new Uint8Array(edgeCount * 2);
  const chars = useTmdb ? new Uint32Array(edgeCount * 2) : undefined;
  let cursor = 0;
  for (let i = 0; i < nodeCount; i++) {
    offsets[i] = cursor;
    const order = adj[i].map((_, k) => k).sort((a, b) => adj[i][a] - adj[i][b]);
    for (const k of order) {
      neighbors[cursor] = adj[i][k];
      tiers[cursor] = adjTier[i][k];
      if (chars) chars[cursor] = adjChar[i][k];
      cursor++;
    }
  }
  offsets[nodeCount] = cursor;
  log(`packed: ${nodeCount} nodes, ${edgeCount} edges${useTmdb ? `, ${characters.length - 1} character names` : ""}`);

  const header: GraphHeader = { buildId: opts.buildId, nodeCount, edgeCount, nodes };
  if (useTmdb) {
    header.characters = characters;
    header.tmdb = { titlesCrawled: opts.tmdb!.size, castCap: TMDB_CAST_CAP };
  }
  return { header, offsets, neighbors, tiers, ...(chars ? { chars } : {}) };
}

/**
 * Build the packed industry graph from IMDb datasets, optionally merging a
 * crawled TMDB cast map. Pure with respect to its inputs.
 */
export async function buildGraph(opts: BuildOptions): Promise<PackedGraph> {
  const stage = await loadImdb(opts);
  return pack(stage, opts);
}

function safeDatasetPath(inputDir: string, base: string): string | null {
  try {
    return datasetPath(inputDir, base);
  } catch {
    return null;
  }
}
