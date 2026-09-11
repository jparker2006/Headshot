/**
 * The per-user half of the title/person drawer: "why this is on your screen".
 *
 * Pure over the industry graph and the taste store so the route stays thin and
 * `tests/route/page.test.ts` can drive it with the fixture graph and
 * `MemoryTasteStore`. Nothing here is ever rendered for a signed-out reader —
 * the caller passes `userId: null` and gets `null` back.
 *
 * The reason rule is the pick engine's rule (`graphReason`): a real graph fact
 * or nothing. For a person we phrase the same fact from the other side ("you
 * liked all three: …") rather than inventing a new kind of claim.
 */
import type { IndustryGraph, NodeInfo } from "@/lib/graph/engine";
import { graphReason, sharedPeople } from "@/lib/picks/engine";
import { normalizeProviderIds, providerName } from "@/lib/taste/providers";
import type { TasteStore, WatchedRating } from "@/lib/taste/types";

export interface PageReason {
  /** One line, plain text. The client bolds the names it can link. */
  text: string;
  /** People and titles the line cites, in the order it cites them. */
  viaImdbIds: string[];
}

export interface PageTaste {
  reason: PageReason | null;
  /**
   * Ids on this page the user already has in their taste, so the face row can
   * ring them: people for a title page, titles for a person page.
   */
  likedPeople: string[];
  /** The user's bucket for this title, when they have one. */
  rating: WatchedRating | null;
  /** Names of the streaming services this is on that the user actually pays for. */
  onYourServices: string[];
}

interface ProviderLike {
  id?: number;
  name: string;
}

export interface PageTasteInput {
  graph: IndustryGraph;
  store: TasteStore;
  userId: string | null;
  node: { imdbId: string; kind: "person" | "title" };
  extras?: { providers?: { flatrate?: ProviderLike[] } | null } | null;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const COUNT_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** "you liked all three: A, B, C" — the person-page half of the reason rule. */
function personReason(titles: NodeInfo[]): PageReason | null {
  if (titles.length === 0) return null;
  const shown = titles.slice(0, 3);
  const names = shown.map((t) => t.name);
  if (titles.length <= 2) return { text: `you liked ${joinNames(names)}`, viaImdbIds: shown.map((t) => t.imdbId) };
  const all = titles.length === shown.length;
  const word = COUNT_WORDS[titles.length] ?? String(titles.length);
  return {
    text: all ? `you liked all ${word}: ${names.join(", ")}` : `you liked ${titles.length} of theirs: ${names.join(", ")}`,
    viaImdbIds: shown.map((t) => t.imdbId),
  };
}

/** The services the user pays for that this title actually streams on, by display name. */
function onYourServices(flatrate: ProviderLike[], providerIds: number[]): string[] {
  const mine = new Set(normalizeProviderIds(providerIds));
  const out: string[] = [];
  for (const p of flatrate) {
    if (p.id === undefined) continue;
    const [canonical] = normalizeProviderIds([p.id]);
    if (canonical === undefined || !mine.has(canonical)) continue;
    const name = providerName(canonical) ?? p.name;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Everything the drawer needs about *this* user and *this* node, or null when
 * nobody is signed in. Never throws for a missing node: an id the graph has
 * never heard of simply has no taste facts.
 */
export async function tasteForPage(input: PageTasteInput): Promise<PageTaste | null> {
  const { graph, store, userId, node, extras } = input;
  if (!userId) return null;

  const [watched, services] = await Promise.all([store.listWatched(userId), store.getServices(userId)]);
  const rating = watched.find((w) => w.titleImdbId === node.imdbId)?.rating ?? null;

  // The pick engine's liked set: what you finished and loved, plus what you saved for later.
  const likedIds = new Set(
    watched
      .filter((w) => w.rating === "liked" || w.rating === "want")
      .map((w) => graph.idOf(w.titleImdbId))
      .filter((id): id is number => id !== undefined),
  );

  const id = graph.idOf(node.imdbId);
  let reason: PageReason | null = null;
  let likedPeople: string[] = [];

  if (id !== undefined && node.kind === "title") {
    const full = graphReason(graph, id, likedIds);
    reason = full ? { text: full.text, viaImdbIds: full.viaImdbIds } : null;
    likedPeople = sharedPeople(graph, id, likedIds).map((p) => p.person.imdbId);
  } else if (id !== undefined && node.kind === "person") {
    // Their titles the user actually liked (not merely saved), most famous first.
    const likedOnly = new Set(
      watched
        .filter((w) => w.rating === "liked")
        .map((w) => graph.idOf(w.titleImdbId))
        .filter((x): x is number => x !== undefined),
    );
    const titles = graph
      .neighbors(id)
      .filter((n) => likedOnly.has(n.id))
      .map((n) => graph.node(n.id))
      .filter((n) => n.kind === "title")
      .sort((a, b) => b.votes - a.votes || a.id - b.id);
    reason = personReason(titles);
    likedPeople = titles.map((t) => t.imdbId);
  }

  return {
    reason,
    likedPeople,
    rating,
    onYourServices: onYourServices(extras?.providers?.flatrate ?? [], services?.providerIds ?? []),
  };
}
