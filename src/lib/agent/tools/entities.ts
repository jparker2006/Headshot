/**
 * find_entities: the cheap first pass at "who does the user mean?".
 * Exact and substring name match over the industry graph plus overlay,
 * then (when the brain has embeddings) a semantic pass. Candidates are shown
 * on the canvas so the user can click the right one.
 */
import { tool } from "ai";
import { z } from "zod";
import { type AgentContext, describe, toCanvasNode } from "../context";

export function entityTools(ctx: AgentContext) {
  return {
    find_entities: tool({
      description:
        "Resolve a name or short description to graph entities (people or titles) with IMDb ids. Try the plainest name first ('Tom Hanks', 'Severance'). Returns candidates ranked by prominence; if several look plausible, show them to the user rather than guessing. If nothing matches, fall back to tmdb_search.",
      inputSchema: z.object({
        query: z.string().min(1),
        kind: z.enum(["person", "title"]).optional(),
        limit: z.number().int().min(1).max(20).default(8),
      }),
      execute: async ({ query, kind, limit }) => {
        const hits = ctx.graph.searchByName(query, limit, kind);
        const candidates = hits.map((n) => toCanvasNode(n));
        ctx.emit("candidates", { query, candidates }, { transient: true });
        return {
          query,
          candidates: hits.map((n) => `${describe(n)} votes=${n.votes}`),
          hint: hits.length === 0 ? "No graph match. Try tmdb_search, then expand_node to bring the entity into the graph." : undefined,
        };
      },
    }),
  };
}
