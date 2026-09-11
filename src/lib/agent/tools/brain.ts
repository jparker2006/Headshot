/**
 * Wiki page tools. Pages are agent-authored markdown with an append-only
 * revision log that records the question behind every edit.
 */
import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../context";

const imdbId = z.string().regex(/^(nm|tt)\d+$/);

export function brainTools(ctx: AgentContext) {
  return {
    read_page: tool({
      description: "Read the brain's wiki page for an entity: what earlier questions already figured out. Check before re-deriving trivia.",
      inputSchema: z.object({ imdbId }),
      execute: async ({ imdbId }) => {
        const page = await ctx.brain.readPage(imdbId);
        if (!page) return { exists: false };
        return { exists: true, body: page.body, revisions: page.revisions.length, updatedAt: page.updatedAt };
      },
    }),

    write_page: tool({
      description:
        "Write or revise an entity's wiki page (markdown, 2-6 short paragraphs). Do this when you learned something worth keeping: notable collaborators, the path they sit on, trivia, why they matter. Revise rather than overwrite: read_page first and merge. Every write is logged with the current question.",
      inputSchema: z.object({ imdbId, body: z.string().min(20) }),
      execute: async ({ imdbId, body }) => {
        const node = ctx.graph.nodeByImdbId(imdbId);
        if (!node && !(await ctx.brain.getNode(imdbId))) {
          return { error: "unknown_entity", hint: "Only write pages for nodes in the graph or brain." };
        }
        const page = await ctx.brain.writePage({ imdbId, body, question: ctx.question });
        ctx.emit("page", { imdbId, question: ctx.question, revision: page.revisions.length });
        return { ok: true, revision: page.revisions.length };
      },
    }),
  };
}
