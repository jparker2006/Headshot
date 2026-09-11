/**
 * The pick engine (v3): "what do I watch tonight", computed. A pure function
 * over the industry graph, the user's watched set, their taste vector, the
 * candidate pool with availability, and tonight's filters. No model, no
 * network. The model only narrates the reason lines afterwards, and the
 * reason rule is enforced here: a candidate without a real graph reason is
 * never a pick.
 */
import type { IndustryGraph, NodeInfo } from "@/lib/graph/engine";

export type Bucket = "liked" | "meh" | "unseen" | "want";

export interface WatchedRow {
  imdbId: string;
  rating: Bucket;
  /** Series the user marked as watching: the season they are on. */
  season?: number | null;
  episodesWatched?: number;
}

export interface TasteFacts {
  people: { imdbId: string; name: string; count: number }[];
  eras: Record<string, number>;
  avgRuntimeFinished: number | null;
  tvShare: number | null;
  genresAvoided: string[];
}

export interface Candidate {
  imdbId: string;
  /** TMDB watch-provider ids where it streams (flatrate) in the user's region. */
  availableOn: number[];
  /** Shown when it is on none of the user's services. */
  rentPrice?: string | null;
  runtimeMin?: number | null;
  /** Optional embedding for the cosine term. */
  vector?: number[] | null;
  /** True when the row came from "trending / new on your services" rather than the graph walk. */
  fresh?: boolean;
}

export interface Filters {
  maxRuntimeMin?: number | null;
  energy?: "light" | "heavy" | "any" | null;
}

export interface PickReason {
  /** One line, graph facts only: "Tom Hanks and Gary Sinise, both in Apollo 13 which you liked". */
  text: string;
  /** People and titles the reason cites, so the client can link them. */
  viaImdbIds: string[];
  kind: "shared-people" | "your-nth" | "continue";
}

export interface Pick {
  imdbId: string;
  name: string;
  year: number;
  titleType: string;
  kind: "start" | "continue";
  score: number;
  reason: PickReason;
  availableOn: number[];
  onYourServices: boolean;
  rentPrice: string | null;
  /** For continue picks: where the user is. */
  progress?: { season: number; episodesWatched: number };
}

export interface PickInputs {
  graph: IndustryGraph;
  watched: WatchedRow[];
  services: number[];
  candidates: Candidate[];
  taste?: { vector: number[] | null; facts?: TasteFacts | null } | null;
  /** IMDb ids the user swiped away; never picked again. */
  dismissed?: Iterable<string>;
  filters?: Filters | null;
  /** Names of people that count as "liked" via titles (default: liked and want). */
  likedBuckets?: Bucket[];
}

export interface PickResult {
  picks: Pick[];
  /** Next-best unseen titles for the swipe deck, best first. */
  deck: Pick[];
  /** Candidates rejected by the reason rule (for tests and logs). */
  rejected: { imdbId: string; why: string }[];
}

const LIGHT = new Set(["Comedy", "Animation", "Family", "Romance", "Musical", "Adventure"]);
const HEAVY = new Set(["Drama", "Crime", "Thriller", "War", "Horror", "Mystery"]);

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * People on a candidate who also appear on titles the user liked, with the
 * liked titles they share. Ordered by how many liked titles they touch.
 */
export function sharedPeople(graph: IndustryGraph, candidateId: number, liked: Set<number>): { person: NodeInfo; likedTitles: NodeInfo[] }[] {
  const out: { person: NodeInfo; likedTitles: NodeInfo[] }[] = [];
  for (const entry of graph.castOf(candidateId)) {
    if (entry.node.kind !== "person") continue;
    const likedTitles = graph
      .neighbors(entry.node.id)
      .filter((n) => liked.has(n.id))
      .map((n) => graph.node(n.id))
      .sort((a, b) => b.votes - a.votes || a.id - b.id);
    if (likedTitles.length) out.push({ person: entry.node, likedTitles });
  }
  out.sort((a, b) => b.likedTitles.length - a.likedTitles.length || b.person.votes - a.person.votes);
  return out;
}

/** The reason rule: a real graph fact or nothing. */
export function graphReason(graph: IndustryGraph, candidateId: number, liked: Set<number>): PickReason | null {
  const shared = sharedPeople(graph, candidateId, liked);
  if (shared.length === 0) return null;
  const top = shared[0];
  if (top.likedTitles.length >= 2) {
    return {
      kind: "your-nth",
      text: `your ${ordinal(top.likedTitles.length + 1)} ${top.person.name}, after ${joinNames(top.likedTitles.slice(0, 2).map((t) => t.name))}`,
      viaImdbIds: [top.person.imdbId, ...top.likedTitles.slice(0, 2).map((t) => t.imdbId)],
    };
  }
  const people = shared.slice(0, 2);
  const commonTitle = people.every((p) => p.likedTitles.some((t) => t.id === people[0].likedTitles[0].id)) ? people[0].likedTitles[0] : null;
  if (people.length === 2 && commonTitle) {
    return {
      kind: "shared-people",
      text: `${joinNames(people.map((p) => p.person.name))}, both in ${commonTitle.name} which you liked`,
      viaImdbIds: [...people.map((p) => p.person.imdbId), commonTitle.imdbId],
    };
  }
  return {
    kind: "shared-people",
    text: `${top.person.name}, who you liked in ${top.likedTitles[0].name}`,
    viaImdbIds: [top.person.imdbId, top.likedTitles[0].imdbId],
  };
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/**
 * Candidate pool from the graph alone: unseen titles adjacent to the people
 * on the user's liked titles, ranked by how many liked titles they share.
 * Availability is unknown here; the caller merges provider data.
 */
export function walkCandidates(graph: IndustryGraph, watched: WatchedRow[], opts: { limit?: number; likedBuckets?: Bucket[] } = {}): { imdbId: string; proximity: number }[] {
  const likedBuckets = new Set(opts.likedBuckets ?? ["liked", "want"]);
  // Only things actually watched are off the table; a Later title ("want") stays a candidate so the list drains.
  const seen = new Set(watched.filter((w) => w.rating === "liked" || w.rating === "meh").map((w) => w.imdbId));
  const liked = watched.filter((w) => likedBuckets.has(w.rating)).map((w) => graph.idOf(w.imdbId)).filter((id): id is number => id !== undefined);
  const scores = new Map<number, number>();
  for (const w of watched) {
    if (w.rating !== "want") continue;
    const id = graph.idOf(w.imdbId);
    if (id !== undefined) scores.set(id, 0.5);
  }
  for (const titleId of liked) {
    for (const person of graph.castOf(titleId)) {
      if (person.node.kind !== "person") continue;
      for (const t of graph.neighbors(person.node.id)) {
        const title = graph.node(t.id);
        if (title.kind !== "title" || seen.has(title.imdbId) || t.id === titleId) continue;
        scores.set(t.id, (scores.get(t.id) ?? 0) + (t.tier === 1 ? 1 : 0.5));
      }
    }
  }
  return [...scores]
    .sort((a, b) => b[1] - a[1] || graph.node(b[0]).votes - graph.node(a[0]).votes)
    .slice(0, opts.limit ?? 60)
    .map(([id, proximity]) => ({ imdbId: graph.node(id).imdbId, proximity }));
}

/** Continue picks: series the user is in the middle of. */
function continuePicks(graph: IndustryGraph, watched: WatchedRow[], services: number[], candidates: Map<string, Candidate>): Pick[] {
  const out: Pick[] = [];
  for (const w of watched) {
    if (w.season == null) continue;
    const node = graph.nodeByImdbId(w.imdbId);
    if (!node || node.kind !== "title" || node.titleType === "movie") continue;
    const c = candidates.get(w.imdbId);
    const availableOn = c?.availableOn ?? [];
    const episodes = w.episodesWatched ?? 0;
    out.push({
      imdbId: node.imdbId,
      name: node.name,
      year: node.year,
      titleType: node.titleType,
      kind: "continue",
      score: 2 + Math.min(episodes, 6) * 0.1,
      reason: {
        kind: "continue",
        text: `one more. you're on season ${w.season}${episodes ? `, ${episodes} episode${episodes === 1 ? "" : "s"} in` : ""}`,
        viaImdbIds: [node.imdbId],
      },
      availableOn,
      onYourServices: availableOn.some((p) => services.includes(p)),
      rentPrice: c?.rentPrice ?? null,
      progress: { season: w.season, episodesWatched: episodes },
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Score and rank. Three picks for tonight (at most one continue), then the
 * deck. Candidates on none of the user's services are kept but ranked below
 * available ones and carry the rent price instead of being hidden.
 */
export function pickTonight(input: PickInputs, opts: { picks?: number; deck?: number } = {}): PickResult {
  const { graph, watched, services } = input;
  const likedBuckets = new Set(input.likedBuckets ?? ["liked", "want"]);
  const liked = new Set(watched.filter((w) => likedBuckets.has(w.rating)).map((w) => graph.idOf(w.imdbId)).filter((id): id is number => id !== undefined));
  const seen = new Set(watched.filter((w) => w.rating === "liked" || w.rating === "meh").map((w) => w.imdbId));
  const dismissed = new Set(input.dismissed ?? []);
  const filters = input.filters ?? {};
  const vector = input.taste?.vector ?? null;
  const byId = new Map(input.candidates.map((c) => [c.imdbId, c]));
  const rejected: { imdbId: string; why: string }[] = [];

  const scored: Pick[] = [];
  for (const c of input.candidates) {
    if (seen.has(c.imdbId)) continue;
    if (dismissed.has(c.imdbId)) {
      rejected.push({ imdbId: c.imdbId, why: "dismissed" });
      continue;
    }
    const id = graph.idOf(c.imdbId);
    if (id === undefined) {
      rejected.push({ imdbId: c.imdbId, why: "not in graph" });
      continue;
    }
    const node = graph.node(id);
    if (node.kind !== "title") continue;
    if (filters.maxRuntimeMin && c.runtimeMin && c.runtimeMin > filters.maxRuntimeMin) {
      rejected.push({ imdbId: c.imdbId, why: "too long" });
      continue;
    }
    if (filters.energy && filters.energy !== "any") {
      const genres = node.genres.split(",").filter(Boolean);
      const want = filters.energy === "light" ? LIGHT : HEAVY;
      const avoid = filters.energy === "light" ? HEAVY : LIGHT;
      if (genres.length && !genres.some((g) => want.has(g)) && genres.some((g) => avoid.has(g))) {
        rejected.push({ imdbId: c.imdbId, why: "wrong energy" });
        continue;
      }
    }
    const reason = graphReason(graph, id, liked);
    if (!reason) {
      rejected.push({ imdbId: c.imdbId, why: "no graph reason" });
      continue;
    }
    const shared = sharedPeople(graph, id, liked);
    const proximity = shared.reduce((s, p) => s + p.likedTitles.length, 0);
    const sim = vector && c.vector ? cosine(vector, c.vector) : 0;
    const onYourServices = c.availableOn.some((p) => services.includes(p));
    const score = sim * 2 + Math.log1p(proximity) + Math.log10(node.votes + 10) * 0.15 + (onYourServices ? 1 : -1.5) + (c.fresh ? 0.2 : 0);
    scored.push({
      imdbId: node.imdbId,
      name: node.name,
      year: node.year,
      titleType: node.titleType,
      kind: "start",
      score,
      reason,
      availableOn: c.availableOn,
      onYourServices,
      rentPrice: onYourServices ? null : (c.rentPrice ?? null),
    });
  }
  scored.sort((a, b) => b.score - a.score || a.imdbId.localeCompare(b.imdbId));

  const nPicks = opts.picks ?? 3;
  const nDeck = opts.deck ?? 8;
  const cont = continuePicks(graph, watched, services, byId).slice(0, 1);
  const picks: Pick[] = [...cont];
  for (const p of scored) {
    if (picks.length >= nPicks) break;
    picks.push(p);
  }
  const pickIds = new Set(picks.map((p) => p.imdbId));
  const deck = scored.filter((p) => !pickIds.has(p.imdbId)).slice(0, nDeck);
  return { picks, deck, rejected };
}

/**
 * Derived facts for the taste record: the people the user keeps watching,
 * decades, TV share. Pure over the graph and the watched set.
 */
export function tasteFacts(graph: IndustryGraph, watched: WatchedRow[], opts: { runtimes?: Map<string, number> } = {}): TasteFacts {
  const liked = watched.filter((w) => w.rating === "liked");
  const counts = new Map<number, number>();
  const eras: Record<string, number> = {};
  let tv = 0;
  let titles = 0;
  let runtimeSum = 0;
  let runtimeN = 0;
  for (const w of liked) {
    const id = graph.idOf(w.imdbId);
    if (id === undefined) continue;
    const node = graph.node(id);
    if (node.kind !== "title") continue;
    titles++;
    if (node.titleType !== "movie") tv++;
    if (node.year) {
      const decade = `${Math.floor(node.year / 10) * 10}s`;
      eras[decade] = (eras[decade] ?? 0) + 1;
    }
    const rt = opts.runtimes?.get(w.imdbId);
    if (rt) {
      runtimeSum += rt;
      runtimeN++;
    }
    for (const c of graph.castOf(id)) if (c.node.kind === "person") counts.set(c.node.id, (counts.get(c.node.id) ?? 0) + 1);
  }
  const people = [...counts]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || graph.node(b[0]).votes - graph.node(a[0]).votes)
    .slice(0, 12)
    .map(([id, count]) => ({ imdbId: graph.node(id).imdbId, name: graph.node(id).name, count }));
  const mehGenres = new Map<string, number>();
  for (const w of watched.filter((x) => x.rating === "meh")) {
    const node = graph.nodeByImdbId(w.imdbId);
    for (const g of node?.genres.split(",").filter(Boolean) ?? []) mehGenres.set(g, (mehGenres.get(g) ?? 0) + 1);
  }
  const likedGenres = new Set(liked.flatMap((w) => graph.nodeByImdbId(w.imdbId)?.genres.split(",").filter(Boolean) ?? []));
  const genresAvoided = [...mehGenres].filter(([g]) => !likedGenres.has(g)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([g]) => g);
  return {
    people,
    eras,
    avgRuntimeFinished: runtimeN ? Math.round(runtimeSum / runtimeN) : null,
    tvShare: titles ? Math.round((tv / titles) * 100) / 100 : null,
    genresAvoided,
  };
}
