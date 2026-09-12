/**
 * find_entities: the cheap first pass at "who does the user mean?".
 * Exact and substring name match over the industry graph plus overlay,
 * then (when the brain has embeddings) a semantic pass. Candidates are shown
 * on the canvas so the user can click the right one.
 */
import { tool } from "ai";
import { z } from "zod";
import { type AgentContext, describe, semanticCandidates, toCanvasNode, touch } from "../context";
import { creditLabel, findByConstraints, selectMatches } from "../identify";
import type { FaceCandidate } from "../events";

const imdbTitle = z.string().regex(/^tt\d+$/, "an IMDb title id like tt0112384");

/** Run the constraint solver, touch what it found, and emit the faces: the one match, or the near-tied few. */
export async function identifyAndEmit(ctx: AgentContext, input: { titles: string[]; roleHint?: string; era?: { from?: number; to?: number }; limit?: number }, query: string) {
  const titleIds = input.titles.map((t) => ctx.graph.idOf(t)).filter((id): id is number => id !== undefined);
  if (titleIds.length === 0) return { error: "unknown_title", hint: "Resolve the title with find_entities first, or expand_node it." };
  const { candidates, total } = findByConstraints(ctx.graph, { titleIds, roleHint: input.roleHint, era: input.era, limit: input.limit ?? 8 });
  // Thin constraints (nobody on every title): fall back to meaning, restricted to people.
  let loose: string[] = [];
  if (candidates.length === 0 && input.roleHint) {
    const titleNames = titleIds.map((id) => ctx.graph.node(id).name).join(", ");
    loose = (await semanticCandidates(ctx, `${input.roleHint} in ${titleNames}`, 6, "person")).map(describe);
  }
  // What the user actually sees: the one match, or the near-tied few. Never the cast.
  const { mode, matches } = selectMatches(candidates);
  const faces: FaceCandidate[] = matches.map((c) => ({
    imdbId: c.node.imdbId,
    name: c.node.name,
    credit: c.credits.map(creditLabel).join("; "),
    character: c.credits[0]?.character ?? null,
    score: Number(c.score.toFixed(2)),
  }));
  await touch(ctx, [...titleIds.map((id) => toCanvasNode(ctx.graph.node(id))), ...matches.map((c) => toCanvasNode(c.node))]);
  for (const c of matches) for (const cr of c.credits) ctx.emit("edge", { personImdbId: c.node.imdbId, titleImdbId: cr.title.imdbId, tier: cr.tier });
  // One face is the answer beside the text; several faces are the question.
  if (faces.length > 0) ctx.emit("faces", { query, candidates: faces, total, mode });
  return {
    mode,
    candidates: faces.map((f) => `${f.name} [${f.imdbId}] — ${f.credit}${f.score ? ` (score ${f.score})` : ""}`),
    total,
    reasons: Object.fromEntries(matches.filter((c) => c.reasons.length).map((c) => [c.node.imdbId, c.reasons])),
    faceGridShown: faces.length > 0,
    semanticGuesses: loose.length ? loose : undefined,
    hint:
      faces.length === 0
        ? "Nobody in the graph is credited on all of these titles. Try fewer titles, expand_node the title, or tmdb_search."
        : mode === "answer"
          ? "One match, and their face is already on screen next to your answer. Name that person in one line and say what they played. Do not ask the user who they meant and do not list anyone else."
          : "These are the only people the description fits and their faces are on screen. Say in one line what they have in common and ask which one. Do not name one of them as the answer, and do not add anyone who is not in this list.",
  };
}

export function entityTools(ctx: AgentContext) {
  return {
    find_by_constraints: tool({
      description:
        "Identify a person from a title plus a vague description. Required whenever the question names at least one title and describes someone instead of naming them ('the bald guy in Severance', 'the villain in Heat', 'who played the astronaut in Apollo 13'). Intersects the casts of all titles given and scores by the role hint against character names, prominence, and era. It returns the one person the description picks out (mode 'answer', their face is shown with your reply) or, only when the description genuinely fits several, the two to four it fits (mode 'choose'). Pass everything the question said about the person as roleHint.",
      inputSchema: z.object({
        titles: z.array(imdbTitle).min(1).max(4).describe("IMDb ids of the titles mentioned"),
        roleHint: z.string().optional().describe("The description of the person or role, verbatim from the question"),
        era: z.object({ from: z.number().int().optional(), to: z.number().int().optional() }).optional().describe("Birth-year window if the question implies an age"),
        limit: z.number().int().min(1).max(8).default(8),
      }),
      execute: async (input) => identifyAndEmit(ctx, input, input.roleHint ?? ctx.question),
    }),

    find_entities: tool({
      description:
        "Resolve a name or short description to graph entities (people or titles) with IMDb ids. Try the plainest name first ('Tom Hanks', 'Severance'). Returns candidates ranked by prominence; if several look plausible, show them to the user rather than guessing. If nothing matches, fall back to tmdb_search.",
      inputSchema: z.object({
        query: z.string().min(1),
        kind: z.enum(["person", "title"]).optional(),
        limit: z.number().int().min(1).max(20).default(8),
      }),
      execute: async ({ query, kind, limit }) => {
        let hits = ctx.graph.searchByName(query, limit, kind);
        let semantic = false;
        if (hits.length === 0) {
          hits = await semanticCandidates(ctx, query, limit, kind);
          semantic = hits.length > 0;
        }
        const candidates = hits.map((n) => toCanvasNode(n));
        ctx.emit("candidates", { query, candidates }, { transient: true });
        return {
          query,
          candidates: hits.map((n) => `${describe(n)} votes=${n.votes}`),
          semantic: semantic || undefined,
          hint: hits.length === 0 ? "No graph match. Try tmdb_search, then expand_node to bring the entity into the graph." : semantic ? "No exact name match; these are the closest by description. Verify before using." : undefined,
        };
      },
    }),
  };
}
