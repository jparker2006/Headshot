/**
 * Taste tools: the agent's hands on the signed-in user's private taste graph.
 * Present only when the request has a user; every write is explicit (the user
 * said it) and stored with source "chat".
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { AgentContext } from "../context";
import { describe } from "../context";
import { loadTonight } from "@/lib/picks/service";
import { tasteSummary } from "../tasteContext";

const imdbTitle = z.string().regex(/^tt\d+$/, "an IMDb title id like tt0113277");

export function tasteTools(ctx: AgentContext): ToolSet {
  const store = ctx.taste;
  const userId = ctx.userId;
  if (!store || !userId) return {};
  return {
    my_taste: tool({
      description: "Everything the user has told us about their taste: counts, services, the people they keep watching, decades, recently rated titles, Later list, series in progress. Call when asked what they like or before judging whether they would like something.",
      inputSchema: z.object({}),
      execute: async () => (await tasteSummary(ctx.graph, store, userId)) ?? { empty: true, hint: "They have not rated anything yet. Suggest onboarding: pick services, import Letterboxd, or swipe the deck." },
    }),

    have_i_seen: tool({
      description: "Whether the user has rated a title, and how (liked, meh, unseen, want = in Later), plus series progress.",
      inputSchema: z.object({ imdbId: imdbTitle }),
      execute: async ({ imdbId }) => {
        const row = (await store.listWatched(userId)).find((r) => r.titleImdbId === imdbId);
        const node = ctx.graph.nodeByImdbId(imdbId);
        return row ? { title: node ? describe(node) : imdbId, rating: row.rating, season: row.season, episodesWatched: row.episodesWatched, source: row.source } : { title: node ? describe(node) : imdbId, rating: null };
      },
    }),

    rate: tool({
      description: "Record what the user just told you about a title: liked, meh (seen, not for them), unseen, or want (add to Later). Only when they actually said it. Use find_entities first if you only have a name.",
      inputSchema: z.object({ imdbId: imdbTitle, rating: z.enum(["liked", "meh", "unseen", "want"]) }),
      execute: async ({ imdbId, rating }) => {
        const node = ctx.graph.nodeByImdbId(imdbId);
        if (!node || node.kind !== "title") return { error: "unknown_title" };
        await store.upsertWatched(userId, [{ titleImdbId: imdbId, rating, source: "chat" }]);
        return { ok: true, title: describe(node), rating };
      },
    }),

    mark_progress: tool({
      description: "The user is watching a series: record the season they are on and/or bump the episode count ('one more episode of X').",
      inputSchema: z.object({ imdbId: imdbTitle, season: z.number().int().min(1).optional(), episodesWatched: z.number().int().min(0).optional() }),
      execute: async ({ imdbId, season, episodesWatched }) => {
        const node = ctx.graph.nodeByImdbId(imdbId);
        if (!node || node.kind !== "title") return { error: "unknown_title" };
        await store.setProgress(userId, imdbId, { season, episodesWatched });
        return { ok: true, title: describe(node), season, episodesWatched };
      },
    }),

    tonight_picks: tool({
      description: "Tonight's three picks for this user (already computed, with one real reason each and where each streams). Use for 'what should I watch', then narrate in your voice; never invent a pick of your own.",
      inputSchema: z.object({}),
      execute: async () => {
        const data = await loadTonight({ graph: ctx.graph, tmdb: ctx.tmdb, store, model: null }, userId);
        if (!data) return { empty: true, hint: "No picks yet: they need at least one rated title. Suggest the deck or a Letterboxd import." };
        return {
          generatedAt: data.generatedAt,
          picks: data.picks.map((p) => ({ imdbId: p.imdbId, title: `${p.name}${p.year ? ` (${p.year})` : ""}`, kind: p.kind, reason: p.reason.text, play: p.playLabel, onYourServices: p.onYourServices })),
          deck: data.deck.slice(0, 5).map((p) => `${p.name}${p.year ? ` (${p.year})` : ""}: ${p.reason.text}`),
        };
      },
    }),
  };
}
