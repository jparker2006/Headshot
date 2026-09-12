/**
 * The onboarding deck: fifty well-known titles chosen for coverage (decades,
 * film and TV) so fifty taps say something about taste. Deterministic over
 * the graph: top titles by votes per decade, alternating movies and series.
 */
import type { IndustryGraph, NodeInfo } from "@/lib/graph/engine";

export interface DeckCardData {
  imdbId: string;
  name: string;
  year: number;
  titleType: string;
  /** What to call it on the card: a film or a show. */
  kind: "film" | "show";
}

/** Genres a swipe deck should never deal: nothing to say about taste. */
const JUNK_GENRES = new Set(["Talk-Show", "Reality-TV", "News", "Game-Show"]);

/**
 * Whether a title node belongs in any swipe deck: a real title, with a year,
 * that is not a talk show. Shared by the onboarding deck and the lore deck.
 */
export function deckEligible(node: NodeInfo): boolean {
  if (node.kind !== "title" || !node.year) return false;
  return !node.genres.split(",").some((g) => JUNK_GENRES.has(g));
}

export function onboardingDeck(graph: IndustryGraph, opts: { size?: number; exclude?: Iterable<string> } = {}): DeckCardData[] {
  const size = opts.size ?? 50;
  const exclude = new Set(opts.exclude ?? []);
  const byDecade = new Map<number, { movies: NodeInfo[]; series: NodeInfo[] }>();
  for (let id = 0; id < graph.nodeCount; id++) {
    const n = graph.node(id);
    if (exclude.has(n.imdbId) || !deckEligible(n)) continue;
    const decade = Math.floor(n.year / 10) * 10;
    let bucket = byDecade.get(decade);
    if (!bucket) byDecade.set(decade, (bucket = { movies: [], series: [] }));
    (n.titleType === "movie" ? bucket.movies : bucket.series).push(n);
  }
  const decades = [...byDecade.keys()].sort((a, b) => b - a).filter((d) => d >= 1960);
  for (const b of byDecade.values()) {
    b.movies.sort((a, c) => c.votes - a.votes || a.id - c.id);
    b.series.sort((a, c) => c.votes - a.votes || a.id - c.id);
  }
  // Round-robin across decades, newest first, movie then series, until the deck is full.
  const out: DeckCardData[] = [];
  const cursors = new Map(decades.map((d) => [d, { m: 0, s: 0 }]));
  let progress = true;
  while (out.length < size && progress) {
    progress = false;
    for (const d of decades) {
      const b = byDecade.get(d)!;
      const c = cursors.get(d)!;
      for (const kind of ["m", "s"] as const) {
        if (out.length >= size) break;
        const list = kind === "m" ? b.movies : b.series;
        const n = list[c[kind]];
        if (!n) continue;
        c[kind]++;
        progress = true;
        out.push({ imdbId: n.imdbId, name: n.name, year: n.year, titleType: n.titleType, kind: n.titleType === "movie" || n.titleType === "tvMovie" ? "film" : "show" });
      }
    }
  }
  return out;
}
