/**
 * The taste map (v3): the user's private ego graph. You at the center, ring 1
 * the people you keep watching (accent = liked, dim = meh, sized by count),
 * ring 2 the titles of theirs you rated. Same shape as the industry ego
 * network so the sigma canvas draws it unchanged.
 */
import type { IndustryGraph } from "@/lib/graph/engine";
import type { EgoNetwork, EgoNode } from "@/lib/graph/ego";
import type { WatchedRow } from "./types";
import { isLiked } from "./score";

export const ME = "me";

export interface TasteMapOptions {
  /** People on ring 1 (default 16). */
  people?: number;
  /** Titles per person on ring 2 (default 4). */
  titlesEach?: number;
}

export function tasteMap(graph: IndustryGraph, watched: WatchedRow[], opts: TasteMapOptions = {}): EgoNetwork {
  const maxPeople = opts.people ?? 16;
  const titlesEach = opts.titlesEach ?? 4;
  const rated = new Map<string, WatchedRow>();
  for (const w of watched) if (w.rating === "rated") rated.set(w.titleImdbId, w);

  // People by how many rated titles they touch, and how many of those were liked.
  const people = new Map<number, { liked: number; meh: number; titles: { id: number; rating: "liked" | "meh" }[] }>();
  for (const [imdbId, w] of rated) {
    const id = graph.idOf(imdbId);
    if (id === undefined) continue;
    for (const c of graph.castOf(id)) {
      if (c.node.kind !== "person") continue;
      let p = people.get(c.node.id);
      if (!p) people.set(c.node.id, (p = { liked: 0, meh: 0, titles: [] }));
      if (isLiked(w)) p.liked++;
      else p.meh++;
      p.titles.push({ id, rating: isLiked(w) ? "liked" : "meh" });
    }
  }
  const ranked = [...people]
    .filter(([, p]) => p.liked + p.meh >= 1)
    .sort((a, b) => b[1].liked + b[1].meh - (a[1].liked + a[1].meh) || b[1].liked - a[1].liked || graph.node(b[0]).votes - graph.node(a[0]).votes)
    .slice(0, maxPeople);

  const center: EgoNode = {
    id: -1,
    imdbId: ME,
    name: "you",
    kind: "person",
    titleType: "",
    year: 0,
    votes: 0,
    genres: "",
    overlay: true,
    ring: 0,
  };
  const nodes: EgoNode[] = [center];
  const edges: EgoNetwork["edges"] = [];
  const seenTitles = new Set<number>();
  for (const [pid, p] of ranked) {
    const person = graph.node(pid);
    const tone: "liked" | "meh" = p.liked >= p.meh ? "liked" : "meh";
    nodes.push({ ...person, ring: 1, tone, count: p.liked + p.meh, votes: Math.max(person.votes, (p.liked + p.meh) * 100000) });
    // The center links to every ring-1 person: the canvas draws person→title edges only, so this
    // edge is carried as (person: ME, title: person) purely for the layout. It is not a credit.
    edges.push({ personImdbId: ME, titleImdbId: person.imdbId, tier: 1 });
    const titles = [...p.titles].sort((a, b) => (a.rating === "liked" ? -1 : 1) - (b.rating === "liked" ? -1 : 1) || graph.node(b.id).votes - graph.node(a.id).votes).slice(0, titlesEach);
    for (const t of titles) {
      const title = graph.node(t.id);
      if (!seenTitles.has(t.id)) {
        seenTitles.add(t.id);
        nodes.push({ ...title, ring: 2, parent: person.imdbId, tone: t.rating });
      }
      edges.push({ personImdbId: person.imdbId, titleImdbId: title.imdbId, tier: 1 });
    }
  }
  return { center: ME, nodes, edges };
}
