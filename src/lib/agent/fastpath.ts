/**
 * The v2 fast path: answer the deterministic part of a question before the
 * model runs. A small regex classifier assigns a shape (path, costar, both,
 * known-for, identify) and the pre-resolution hints supply exact, unambiguous
 * entity ids. When both line up the server computes the result with the same
 * tool code the model would have called, streams the chain or card first,
 * and hands the model the result to narrate.
 *
 * Ambiguity (a name with two close exact matches, or a name that did not
 * resolve) falls through to the agent as before.
 */
import type { IndustryGraph, NodeInfo } from "@/lib/graph/engine";
import type { AnswerShape, PathsFound } from "./events";
import type { AgentContext } from "./context";
import { graphTools } from "./tools/graph";
import { describe } from "./context";

export interface Classified {
  shape: AnswerShape;
  /** Resolved entities in question order. */
  entities: NodeInfo[];
}

/** The subject spans a classifier needs, before entity resolution. */
interface ShapeMatch {
  shape: AnswerShape;
  /** Names as they appear in the question. */
  names: string[];
  wantKinds: ("person" | "title")[];
}

const NAME = "(.+?)";
const END = "\\s*[?.!]*\\s*$";

const PATTERNS: { shape: AnswerShape; re: RegExp; kinds: ("person" | "title")[] }[] = [
  // path: how is A connected to B / connect A to B / degrees between A and B / A to B
  { shape: "path", re: new RegExp(`^(?:how (?:is|are|was) )?${NAME} (?:connected|linked|related) (?:to|with) ${NAME}${END}`, "i"), kinds: ["person", "person"] },
  { shape: "path", re: new RegExp(`^(?:connect|link) ${NAME} (?:to|and|with) ${NAME}${END}`, "i"), kinds: ["person", "person"] },
  { shape: "path", re: new RegExp(`^(?:how many )?(?:degrees|hops|steps) (?:between|from) ${NAME} (?:and|to) ${NAME}${END}`, "i"), kinds: ["person", "person"] },
  { shape: "path", re: new RegExp(`^(?:what is |what's )?the (?:shortest )?(?:path|chain|link|connection) (?:between|from) ${NAME} (?:and|to) ${NAME}${END}`, "i"), kinds: ["person", "person"] },
  { shape: "path", re: new RegExp(`^${NAME} (?:to|→|->) ${NAME}${END}`, "i"), kinds: ["person", "person"] },
  // costar: have A and B worked together / did A and B ever work together / were A and B in anything together
  { shape: "costar", re: new RegExp(`^(?:have|has|did|do|were|was) ${NAME} (?:and|&) ${NAME} (?:ever )?(?:worked|work|been|appeared|appear|acted|act|starred|star)(?: in anything| in something| in a movie| in a film)? together${END}`, "i"), kinds: ["person", "person"] },
  { shape: "costar", re: new RegExp(`^(?:what|which) (?:movies|films|shows|titles|things)? ?(?:have|did|do) ${NAME} (?:and|&) ${NAME} (?:both )?(?:done|do|make|share|appear in|star in|work on)(?: together)?${END}`, "i"), kinds: ["person", "person"] },
  // both: who was in both X and Y
  { shape: "both", re: new RegExp(`^who (?:was|is|were|are|has been|appeared|appears|acted|starred) (?:in |on )?both ${NAME} (?:and|&) ${NAME}${END}`, "i"), kinds: ["title", "title"] },
  { shape: "both", re: new RegExp(`^(?:who|which actors?|what actors?) (?:was|is|were|are|appeared|appears) in (?:both )?${NAME} (?:and|&) (?:also )?(?:in )?${NAME}${END}`, "i"), kinds: ["title", "title"] },
  // known-for: what is A best known for / what else has A been in / what has A done
  { shape: "known-for", re: new RegExp(`^what (?:is|was|'s) ${NAME} (?:best |most )?(?:known|famous) for${END}`, "i"), kinds: ["person"] },
  { shape: "known-for", re: new RegExp(`^what (?:else )?(?:has|have|did|is|was) ${NAME} (?:been in|done|in|appeared in|starred in|made|acted in)${END}`, "i"), kinds: ["person"] },
  { shape: "known-for", re: new RegExp(`^(?:list |show me )?${NAME}(?:'s|’s) (?:credits|movies|films|filmography|shows|roles)${END}`, "i"), kinds: ["person"] },
  // identify: who played X in Y / who is the actor who played X in Y. Computed in chunk B; classified now.
  { shape: "identify", re: new RegExp(`^who (?:played|plays|was|is) (?:the )?${NAME} (?:in|on|from) ${NAME}${END}`, "i"), kinds: ["person", "title"] },
];

function clean(s: string): string {
  return s.trim().replace(/^["“”']+|["“”']+$/g, "").trim();
}

/** Match the question text alone. Exported for tests; `classify` adds entity resolution. */
export function matchShape(question: string): ShapeMatch | null {
  const q = question.trim().replace(/\s+/g, " ");
  for (const p of PATTERNS) {
    const m = q.match(p.re);
    if (!m) continue;
    const names = m.slice(1).map(clean).filter(Boolean);
    if (names.length !== p.kinds.length) continue;
    // A name that still contains a question word is a sign the regex over-matched.
    if (names.some((n) => /\b(who|what|which|how|where|when)\b/i.test(n))) continue;
    return { shape: p.shape, names, wantKinds: p.kinds };
  }
  return null;
}

/**
 * The one exact, unambiguous graph match for a name, or null. Two exact
 * matches with close prominence (same rule as the pre-resolution hints) are
 * ambiguous and go to the agent.
 */
export function resolveExact(graph: IndustryGraph, name: string, kind: "person" | "title"): NodeInfo | null {
  const key = name.toLowerCase();
  const exact = graph.searchByName(name, 5, kind).filter((n) => n.name.toLowerCase() === key);
  if (exact.length === 0) return null;
  if (exact[1] && exact[1].votes > exact[0].votes * 0.4) return null;
  return exact[0];
}

/**
 * Assign a shape and resolve every entity exactly, or return null so the
 * agent handles the question the ordinary way. `identify` resolves the title
 * only; the person span is a description, not a name.
 */
export function classify(graph: IndustryGraph, question: string): Classified | null {
  const m = matchShape(question);
  if (!m) return null;
  const entities: NodeInfo[] = [];
  for (let i = 0; i < m.names.length; i++) {
    const kind = m.wantKinds[i];
    if (m.shape === "identify" && kind === "person") continue;
    const node = resolveExact(graph, m.names[i], kind);
    if (!node) return null;
    entities.push(node);
  }
  if (m.shape !== "identify" && new Set(entities.map((e) => e.imdbId)).size !== entities.length) return null;
  return { shape: m.shape, entities };
}

export interface FastResult {
  shape: AnswerShape;
  imdbIds: string[];
  /** What the model gets in its system prompt. */
  context: string;
  /** Machine summary stored with the answer. */
  summary: unknown;
  chosenPath: string[] | null;
}

/**
 * Compute the deterministic answer and stream it. Reuses the graph tools'
 * execute functions so the events and the brain writes are identical to a
 * model-driven call.
 */
export async function runFastPath(ctx: AgentContext, c: Classified): Promise<FastResult | null> {
  const tools = graphTools(ctx);
  const ids = c.entities.map((e) => e.imdbId);
  const opts = { toolCallId: "fast", messages: [], context: undefined as never };
  switch (c.shape) {
    case "path": {
      const r = (await tools.shortest_path.execute!({ from: ids[0], to: ids[1] }, opts)) as PathsFound & { autoHighlighted?: { tier: "strong" | "full"; index: number } };
      const auto = r.autoHighlighted ?? null;
      const set = auto?.tier === "full" ? r.full : r.strong ?? r.full;
      const chosen = set?.paths[auto?.index ?? 0] ?? null;
      const lines = [
        `shortest_path(${ids[0]}, ${ids[1]}) has already been run and the best route is lit on the canvas. Do not call shortest_path or highlight_path again.`,
        `Result: ${JSON.stringify(r)}`,
      ];
      return { shape: "path", imdbIds: ids, context: lines.join("\n"), summary: r, chosenPath: chosen?.imdbIds ?? null };
    }
    case "costar": {
      const r = await tools.shared_credits.execute!({ personA: ids[0], personB: ids[1] }, opts);
      return {
        shape: "costar",
        imdbIds: ids,
        context: `shared_credits(${ids[0]}, ${ids[1]}) has already been run. Do not call it again.\nResult: ${JSON.stringify(r)}`,
        summary: r,
        chosenPath: null,
      };
    }
    case "both": {
      const r = await tools.common_neighbors.execute!({ a: ids[0], b: ids[1], limit: 40 }, opts);
      return {
        shape: "both",
        imdbIds: ids,
        context: `common_neighbors(${ids[0]}, ${ids[1]}) has already been run. Do not call it again.\nResult: ${JSON.stringify(r)}`,
        summary: r,
        chosenPath: null,
      };
    }
    case "known-for": {
      const r = await tools.neighborhood.execute!({ id: ids[0], limit: 20 }, opts);
      return {
        shape: "known-for",
        imdbIds: ids,
        context: `neighborhood(${ids[0]}) has already been run (credits sorted by prominence). Do not call it again.\nResult: ${JSON.stringify(r)}`,
        summary: r,
        chosenPath: null,
      };
    }
    case "identify":
      // Chunk B adds find_by_constraints; until then the title is only a hint.
      return {
        shape: "identify",
        imdbIds: ids,
        context: `The title in the question is ${describe(c.entities[0])}.`,
        summary: null,
        chosenPath: null,
      };
  }
}
