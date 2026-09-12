/**
 * Swipe as lore (SPEC v4): where a swipe session's thirty cards come from once
 * the log has something to say. Two sources, one deck:
 *
 *   (a) unrated neighbours of the people on the user's favourite titles (score
 *       >= 8), ranked by how many of those people a title shares, then votes;
 *   (b) popular unrated titles from the user's two strongest decades, by votes.
 *
 * Interleaved roughly 2:1 (a is the signal, b is the breadth), deduped, and
 * with everything the user has already answered for — any state, including
 * `seen` and `want` — removed. Film and series are both eligible.
 *
 * Pure over the graph and the watched set: no network, no model, no store.
 * Below five liked titles (score >= 7) there is nothing to walk from, so the deck falls
 * back to the fixed onboarding deck and says so (`mode: "cold"`).
 */
import type { IndustryGraph, NodeInfo } from "@/lib/graph/engine";
import type { WatchedRow } from "./engine";
import { isLiked } from "@/lib/taste/score";
import { deckEligible, onboardingDeck, type DeckCardData } from "./onboarding";

/** The deck the client asks for by default. */
export const DEFAULT_DECK_SIZE = 30;
/** Hard cap, so `?size=` cannot ask for the whole graph. */
export const MAX_DECK_SIZE = 50;
/** Liked titles (score >= 7) needed before the walk beats the fixed deck. */
export const MIN_LIKED_FOR_LORE = 5;

/**
 * SPEC v5, "probably seen": the walk starts from the people on the titles they
 * rated *eight* or better, not merely liked. A favourite is a stronger signal
 * than a like, and the deck is guessing at what they have already watched.
 */
export const DECK_PEOPLE_MIN_SCORE = 8;

export interface DeckSourceOptions {
  /** Cards wanted; clamped to `MAX_DECK_SIZE`. */
  size?: number;
  /** Cold-start threshold; the spec's five. Lowered by tests. */
  minLiked?: number;
}

export interface DeckSourceResult {
  cards: DeckCardData[];
  /** "lore" when the deck came from the user's own graph, "cold" on fallback. */
  mode: "lore" | "cold";
}

/** `?size=` → a deck size: default 30, at most 50, junk ignored. */
export function parseDeckSize(param: string | null | undefined): number {
  const n = Number(param);
  if (!param || !Number.isFinite(n) || n < 1) return DEFAULT_DECK_SIZE;
  return Math.min(Math.floor(n), MAX_DECK_SIZE);
}

/** A card from a graph node; `kind` so the client can say film or show. */
export function deckCard(node: NodeInfo): DeckCardData {
  return {
    imdbId: node.imdbId,
    name: node.name,
    year: node.year,
    titleType: node.titleType,
    kind: node.titleType === "movie" || node.titleType === "tvMovie" ? "film" : "show",
  };
}

export function deckSource(graph: IndustryGraph, watched: WatchedRow[], opts: DeckSourceOptions = {}): DeckSourceResult {
  const size = Math.min(opts.size ?? DEFAULT_DECK_SIZE, MAX_DECK_SIZE);
  // Anything with a row has been answered: it never comes back in a deck,
  // whatever the state.
  const rated = new Set(watched.map((w) => w.imdbId));
  const liked = watched
    .filter(isLiked)
    .map((w) => graph.idOf(w.imdbId))
    .filter((id): id is number => id !== undefined);

  if (liked.length < (opts.minLiked ?? MIN_LIKED_FOR_LORE)) {
    return { cards: onboardingDeck(graph, { size, exclude: rated }), mode: "cold" };
  }

  const eligible = (id: number): NodeInfo | null => {
    const node = graph.node(id);
    return node.kind === "title" && !rated.has(node.imdbId) && deckEligible(node) ? node : null;
  };

  // (a) Neighbours of their favourite people (titles rated >= 8, plus what
  // they saved for later), by how many of those people a title shares.
  const likedTitles = new Set(
    watched
      .filter((w) => (w.score ?? 0) >= DECK_PEOPLE_MIN_SCORE || w.rating === "want")
      .map((w) => graph.idOf(w.imdbId))
      .filter((id): id is number => id !== undefined),
  );
  const people = new Set<number>();
  for (const titleId of likedTitles) for (const c of graph.castOf(titleId)) if (c.node.kind === "person") people.add(c.node.id);
  const shared = new Map<number, number>();
  for (const personId of people) {
    for (const t of graph.neighbors(personId)) {
      if (likedTitles.has(t.id) || !eligible(t.id)) continue;
      shared.set(t.id, (shared.get(t.id) ?? 0) + 1);
    }
  }
  const neighbours = [...shared]
    .sort((a, b) => b[1] - a[1] || graph.node(b[0]).votes - graph.node(a[0]).votes || a[0] - b[0])
    .map(([id]) => id);

  // (b) The two strongest decades, by liked count, then popular titles in them.
  const likedByDecade = new Map<number, number>();
  for (const id of liked) {
    const node = graph.node(id);
    if (node.kind !== "title" || !node.year) continue;
    const decade = Math.floor(node.year / 10) * 10;
    likedByDecade.set(decade, (likedByDecade.get(decade) ?? 0) + 1);
  }
  const strongest = new Set(
    [...likedByDecade]
      .sort((a, b) => b[1] - a[1] || b[0] - a[0])
      .slice(0, 2)
      .map(([decade]) => decade),
  );
  const fill: number[] = [];
  for (let id = 0; id < graph.nodeCount; id++) {
    const node = eligible(id);
    if (!node || !node.year || !strongest.has(Math.floor(node.year / 10) * 10)) continue;
    fill.push(id);
  }
  fill.sort((a, b) => graph.node(b).votes - graph.node(a).votes || a - b);

  return { cards: interleave(graph, neighbours, fill, size), mode: "lore" };
}

/**
 * Two ranked lists into one deck, roughly two from `a` for every one from `b`,
 * skipping anything already taken and draining whichever list outlives the
 * other.
 */
function interleave(graph: IndustryGraph, a: number[], b: number[], size: number): DeckCardData[] {
  const taken = new Set<number>();
  const out: DeckCardData[] = [];
  const cursors = { a: 0, b: 0 };
  const push = (list: number[], key: "a" | "b"): boolean => {
    while (cursors[key] < list.length) {
      const id = list[cursors[key]++];
      if (taken.has(id)) continue;
      taken.add(id);
      out.push(deckCard(graph.node(id)));
      return true;
    }
    return false;
  };
  while (out.length < size) {
    let progress = false;
    for (let k = 0; k < 2 && out.length < size; k++) if (push(a, "a")) progress = true;
    if (out.length < size && push(b, "b")) progress = true;
    if (!progress) break;
  }
  return out;
}
