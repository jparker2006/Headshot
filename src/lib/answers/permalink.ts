/**
 * Permalinks (v2 chunk C): /a/<slug>-<shortid> renders a stored public answer.
 * This module is the testable half: parsing, loading, and shaping the page
 * data. The route files under src/app/a are thin.
 */
import type { Brain, StoredAnswer } from "@/lib/brain/types";
import type { IndustryGraph } from "@/lib/graph/engine";
import { egoNetwork, type EgoNetwork } from "@/lib/graph/ego";
import type { TmdbClient } from "@/lib/tmdb/client";
import { CACHEABLE, cacheKey } from "@/lib/agent/answers";
import { classify } from "@/lib/agent/fastpath";

const ID_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/;

export function parsePermalink(param: string): { slug: string; id: string } | null {
  const at = param.lastIndexOf("-");
  if (at <= 0) return null;
  const id = param.slice(at + 1);
  const slug = param.slice(0, at);
  if (!ID_RE.test(id) || !/^[a-z0-9-]+$/.test(slug)) return null;
  return { slug, id };
}

export function permalinkPath(a: Pick<StoredAnswer, "slug" | "id">): string {
  return `/a/${a.slug}-${a.id}`;
}

export interface ChainNode {
  imdbId: string;
  name: string;
  kind: "person" | "title";
  year: number;
  imageUrl: string | null;
}

export interface AnswerPage {
  answer: StoredAnswer;
  /** The lit path (or the entities themselves when the shape has no path). */
  chain: ChainNode[];
  /** Titles on the chain, i.e. degrees apart; null when the shape has no path. */
  degrees: number | null;
  /** Human title: "Heath Ledger to Natalie Portman". */
  title: string;
  firstPerson: ChainNode | null;
  followups: { text: string; href: string }[];
  ego: EgoNetwork | null;
  url: string;
}

export interface PermalinkDeps {
  brain: Brain;
  graph: IndustryGraph;
  tmdb: TmdbClient | null;
  /** Site origin for absolute URLs (metadata). */
  origin?: string;
}

async function imageFor(deps: PermalinkDeps, imdbId: string): Promise<string | null> {
  const node = await deps.brain.getNode(imdbId).catch(() => null);
  if (node?.posterUrl) return node.posterUrl;
  if (!deps.tmdb) return null;
  try {
    const r = await deps.tmdb.imageFor(imdbId);
    if (node && r) await deps.brain.updateNode(imdbId, { tmdbId: r.tmdbId, posterUrl: r.imageUrl, knownAs: r.knownAs });
    return r?.imageUrl ?? null;
  } catch {
    return null;
  }
}

/** Where a follow-up goes: its own permalink when already answered publicly, else the app with the question prefilled. */
export async function followupHref(deps: Pick<PermalinkDeps, "brain" | "graph">, question: string): Promise<string> {
  const c = classify(deps.graph, question);
  if (c && CACHEABLE.has(c.shape)) {
    const hit = await deps.brain.getAnswer(cacheKey(c.shape, c.entities.map((e) => e.imdbId))).catch(() => null);
    if (hit?.public) return permalinkPath(hit);
  }
  return `/?q=${encodeURIComponent(question)}`;
}

export function pageTitle(answer: StoredAnswer, names: string[]): string {
  const [a, b] = names;
  switch (answer.shape) {
    case "path":
      return `${a} to ${b}`;
    case "costar":
      return `${a} and ${b}`;
    case "both":
      return `Who was in both ${a} and ${b}`;
    case "known-for":
      return `What ${a} is known for`;
    default:
      return answer.question;
  }
}

/** Load a public answer as page data, or null when missing or private. */
export async function loadAnswerPage(deps: PermalinkDeps, param: string): Promise<AnswerPage | null> {
  const parsed = parsePermalink(param);
  if (!parsed) return null;
  const answer = await deps.brain.answerById(parsed.id);
  if (!answer || !answer.public) return null;

  deps.graph.setOverlay(await deps.brain.getOverlay());
  const ids = answer.chosenPath?.length ? answer.chosenPath : answer.entityIds;
  const chain: ChainNode[] = await Promise.all(
    ids.map(async (imdbId) => {
      const node = deps.graph.nodeByImdbId(imdbId);
      const stored = node ? null : await deps.brain.getNode(imdbId);
      return {
        imdbId,
        name: node?.name ?? stored?.name ?? imdbId,
        kind: (node?.kind ?? stored?.kind ?? (imdbId.startsWith("nm") ? "person" : "title")) as "person" | "title",
        year: node?.year ?? stored?.year ?? 0,
        imageUrl: await imageFor(deps, imdbId),
      };
    }),
  );
  const degrees = answer.chosenPath?.length ? chain.filter((n) => n.kind === "title").length : null;
  const firstPerson = chain.find((n) => n.kind === "person") ?? null;
  const entityNames = answer.entityIds.map((id) => chain.find((c) => c.imdbId === id)?.name ?? deps.graph.nodeByImdbId(id)?.name ?? id);
  // Keep the question's order for the title: the stored ids are sorted, the chain is not.
  const orderedNames = answer.chosenPath?.length ? [chain[0].name, chain[chain.length - 1].name] : entityNames;
  const followups = await Promise.all(answer.followups.map(async (text) => ({ text, href: await followupHref(deps, text) })));
  const centerId = firstPerson ? deps.graph.idOf(firstPerson.imdbId) : undefined;
  const ego = centerId === undefined ? null : egoNetwork(deps.graph, centerId, { ring1: 16, ring2Parents: 0 });
  const origin = deps.origin ?? "";
  return { answer, chain, degrees, title: pageTitle(answer, orderedNames), firstPerson, followups, ego, url: `${origin}${permalinkPath(answer)}` };
}
