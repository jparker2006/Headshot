/**
 * Identification (v2 headline): "who is that guy from that show" solved
 * deterministically over the graph. Intersect cast sets across the titles the
 * question mentions, then score by role hint against character and person
 * names, prominence, and era. No model, no network.
 */
import type { CastEntry, IndustryGraph, NodeInfo } from "@/lib/graph/engine";

export interface Constraints {
  /** Internal node ids of the titles mentioned. At least one is expected. */
  titleIds: number[];
  /** Free text about the role or the person ("the bald guy", "the villain", "played the astronaut"). */
  roleHint?: string;
  /** Person born, or title released, within this window. */
  era?: { from?: number; to?: number };
  limit?: number;
}

export interface Candidate {
  node: NodeInfo;
  /** Credits on the mentioned titles, title order. */
  credits: { title: NodeInfo; character: string | null; tier: number }[];
  score: number;
  /** The part of the score the role hint contributed (0 when it matched nothing). */
  hintMatch: number;
  /** Why it scored, for the model and for tests. */
  reasons: string[];
}

/**
 * The role hint is the question. A match on a character name ("priest" ↔ "The
 * Priest") or on the person's own name has to dominate prominence (0..1) and
 * the strong-tier bonus, so that one named role beats the top of the bill.
 */
export const CHARACTER_WEIGHT = 4;
export const NAME_WEIGHT = 3;
/**
 * Scores within this of the best are "close": the question did not actually
 * choose between them, so the user does. A whole hint token is worth
 * CHARACTER_WEIGHT and half a token (a stem match) half of that, so this only
 * ever ties people the hint treated the same way.
 */
export const TIE_EPSILON = 0.35;
/** Never put more than this many faces in front of the user. Never the cast. */
export const MAX_CHOICES = 4;

export interface Selection {
  /**
   * `answer`: one person, shown as the answer with their face.
   * `choose`: the hint genuinely fits these (and only these) — ask.
   */
  mode: "answer" | "choose";
  matches: Candidate[];
}

/**
 * Turn a scored list into what the user sees. One candidate clear of the field
 * by more than TIE_EPSILON is the answer; otherwise the near-tied few (at most
 * MAX_CHOICES) are the choice. Never the rest of the cast.
 */
export function selectMatches(candidates: Candidate[]): Selection {
  if (candidates.length === 0) return { mode: "choose", matches: [] };
  const top = candidates[0];
  const tied = candidates.filter((c) => top.score - c.score <= TIE_EPSILON).slice(0, MAX_CHOICES);
  if (tied.length <= 1) return { mode: "answer", matches: [top] };
  return { mode: "choose", matches: tied };
}

const STOP = new Set(["the", "a", "an", "guy", "girl", "man", "woman", "who", "that", "one", "actor", "actress", "played", "plays", "play", "in", "on", "from", "of", "and", "with", "was", "is", "character", "role", "person", "lady", "dude", "kid", "boy"]);

export function hintTokens(hint: string | undefined): string[] {
  if (!hint) return [];
  return hint
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^'|'$/g, ""))
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function tokenOverlap(tokens: string[], text: string | null | undefined): number {
  if (!text || tokens.length === 0) return 0;
  const hay = text.toLowerCase();
  let n = 0;
  for (const t of tokens) {
    if (hay.includes(t)) n++;
    // Simple stemming: "villain" ~ "villains", "doctor" ~ "doctors"
    else if (t.length > 4 && hay.includes(t.slice(0, -1))) n += 0.5;
  }
  return n;
}

/**
 * Find people credited on every mentioned title, scored. Titles that are not
 * titles (a person id by mistake) are ignored. Returns up to `limit`
 * (default 8) candidates, best first, and the size of the intersection.
 */
export function findByConstraints(graph: IndustryGraph, c: Constraints): { candidates: Candidate[]; total: number } {
  const titles = c.titleIds.map((id) => graph.node(id)).filter((n) => n.kind === "title");
  if (titles.length === 0) return { candidates: [], total: 0 };
  const limit = c.limit ?? 8;
  const tokens = hintTokens(c.roleHint);

  // Cast per title, then intersect on the first title's cast.
  const casts = titles.map((t) => {
    const map = new Map<number, CastEntry>();
    for (const e of graph.castOf(t.id)) if (e.node.kind === "person") map.set(e.node.id, e);
    return map;
  });
  const people: number[] = [];
  for (const id of casts[0].keys()) if (casts.every((m) => m.has(id))) people.push(id);

  const maxVotes = Math.max(1, ...people.map((id) => graph.node(id).votes));
  const scored: Candidate[] = people.map((id) => {
    const node = graph.node(id);
    const credits = titles.map((t, i) => {
      const e = casts[i].get(id)!;
      return { title: t, character: e.character, tier: e.tier };
    });
    const reasons: string[] = [];
    let score = 0;
    let hintMatch = 0;
    // Prominence: 0..1, log-scaled so the top of the bill does not drown the hint.
    const prominence = Math.log1p(node.votes) / Math.log1p(maxVotes);
    score += prominence;
    // Strong-tier credits (real roles, not talk-show soup) beat weak ones.
    const strong = credits.filter((cr) => cr.tier === 1).length;
    score += strong * 0.25;
    if (tokens.length) {
      const charHits = Math.max(...credits.map((cr) => tokenOverlap(tokens, cr.character)));
      const nameHits = tokenOverlap(tokens, node.name);
      if (charHits) reasons.push(`character matches "${c.roleHint}"`);
      if (nameHits) reasons.push(`name matches "${c.roleHint}"`);
      hintMatch = charHits * CHARACTER_WEIGHT + nameHits * NAME_WEIGHT;
      score += hintMatch;
    }
    if (c.era && node.year) {
      const { from, to } = c.era;
      const inEra = (from === undefined || node.year >= from) && (to === undefined || node.year <= to);
      if (inEra) {
        score += 0.5;
        reasons.push(`born ${node.year}`);
      } else score -= 1;
    }
    return { node, credits, score, hintMatch, reasons };
  });
  scored.sort((a, b) => b.score - a.score || b.node.votes - a.node.votes || a.node.id - b.node.id);
  return { candidates: scored.slice(0, limit), total: scored.length };
}

/** Text summary of one credit: "Apollo 13 (1995) as Jim Lovell". */
export function creditLabel(cr: Candidate["credits"][number]): string {
  return `${cr.title.name}${cr.title.year ? ` (${cr.title.year})` : ""}${cr.character ? ` as ${cr.character}` : ""}`;
}
