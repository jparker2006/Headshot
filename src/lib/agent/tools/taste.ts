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
import { memoryText } from "@/lib/memory";
import { isValidScore } from "@/lib/taste/score";
import type { WatchedRating } from "@/lib/taste/types";

const imdbTitle = z.string().regex(/^tt\d+$/, "an IMDb title id like tt0113277");

/** How a state with no score reads back in the record. */
const VERB: Record<string, string> = { unseen: "never seen", want: "wants to watch", seen: "watched (no opinion)" };

export function tasteTools(ctx: AgentContext): ToolSet {
  const store = ctx.taste;
  const userId = ctx.userId;
  if (!store || !userId) return {};
  return {
    my_taste: tool({
      description: "What you know about this user: first your own memory of them (the notes you keep, including lines they pinned), then the facts — counts, services, the people they keep watching, decades, recently rated titles, Later list, series in progress. Call when asked what they like or before judging whether they would like something.",
      inputSchema: z.object({}),
      execute: async () => {
        const [memory, facts] = await Promise.all([memoryText(store, userId), tasteSummary(ctx.graph, store, userId)]);
        if (!memory && !facts) return { empty: true, hint: "They have not rated anything yet. Suggest onboarding: pick services, import Letterboxd, or swipe the deck." };
        return { memory: memory || null, facts };
      },
    }),

    recall: tool({
      description: "Search everything this user has done or said about film and TV (logs, swipes, chat), newest first. Use for 'what did I say about X', 'when did I watch X', or to check the memory against the record before claiming something.",
      inputSchema: z.object({ query: z.string().describe("A word or title to search the record for; empty for the most recent activity."), limit: z.number().int().min(1).max(50).optional() }),
      execute: async ({ query, limit }) => {
        const rows = await store.listEpisodes(userId, { query: query.trim() || undefined, limit: limit ?? 12 });
        if (rows.length === 0) return { empty: true, query, hint: "Nothing in the record for that. Say so rather than guessing." };
        return { query, episodes: rows.map((r) => `${r.at.slice(0, 10)} [${r.kind}] ${r.text}`) };
      },
    }),

    have_i_seen: tool({
      description: "Whether the user has a row for a title: the state (rated, want = in Later, seen = watched with no opinion, unseen = never seen), their 1-10 score when they rated it, and series progress.",
      inputSchema: z.object({ imdbId: imdbTitle }),
      execute: async ({ imdbId }) => {
        const row = (await store.listWatched(userId)).find((r) => r.titleImdbId === imdbId);
        const node = ctx.graph.nodeByImdbId(imdbId);
        const title = node ? describe(node) : imdbId;
        if (!row) return { title, state: null, score: null };
        return { title, state: row.rating, score: row.score, season: row.season, episodesWatched: row.episodesWatched, source: row.source };
      },
    }),

    log: tool({
      description:
        "Log what the user just told you about a title: a score out of 10 (7 and up is a like, 6 and under is not), or a state with no score — want (add to Later), seen (watched, no opinion), unseen (never seen). Only when they actually said it. Pass imdbId when you have it, otherwise query with the name and it resolves against the graph.",
      inputSchema: z.object({
        imdbId: imdbTitle.optional(),
        query: z.string().optional().describe("The title's name, when you do not have its id."),
        score: z.number().int().min(1).max(10).optional().describe("Their rating out of 10. loved 9, liked 8, fine 6, didn't like 4, hated 2."),
        state: z.enum(["want", "seen", "unseen"]).optional(),
        note: z.string().optional().describe("What they said about it, in their words."),
      }),
      execute: async ({ imdbId, query, score, state, note }) => {
        const node = imdbId ? ctx.graph.nodeByImdbId(imdbId) : (ctx.graph.searchByName(query ?? "", 1, "title")[0] ?? undefined);
        if (!node || node.kind !== "title") return { error: "unknown_title", query: query ?? imdbId ?? null };
        if (score != null && !isValidScore(score)) return { error: "score must be an integer 1-10" };
        if (score == null && !state) return { error: "say a score out of 10 or a state (want, seen, unseen)" };
        const write: { rating: WatchedRating; score: number | null } = score != null ? { rating: "rated", score } : { rating: state as WatchedRating, score: null };
        await store.upsertWatched(userId, [{ titleImdbId: node.imdbId, ...write, source: "chat" }]);
        // Every write is evidence: the memory rewrite reads episodes, not rows.
        const said = note?.trim() ? `: "${note.trim()}"` : "";
        await store.addEpisodes(userId, [
          {
            kind: "chat",
            titleImdbId: node.imdbId,
            text: write.rating === "rated" ? `rated ${node.name}${node.year ? ` (${node.year})` : ""} ${write.score}/10${said}` : `${VERB[write.rating]} ${node.name}${node.year ? ` (${node.year})` : ""}${said}`,
          },
        ]);
        return { ok: true, title: describe(node), state: write.rating, score: write.score };
      },
    }),

    mark_progress: tool({
      description: "The user is watching a series: record the season they are on and/or bump the episode count ('one more episode of X').",
      inputSchema: z.object({ imdbId: imdbTitle, season: z.number().int().min(1).optional(), episodesWatched: z.number().int().min(0).optional() }),
      execute: async ({ imdbId, season, episodesWatched }) => {
        const node = ctx.graph.nodeByImdbId(imdbId);
        if (!node || node.kind !== "title") return { error: "unknown_title" };
        await store.setProgress(userId, imdbId, { season, episodesWatched });
        const where = [season != null ? `season ${season}` : "", episodesWatched != null ? `${episodesWatched} episodes in` : ""].filter(Boolean).join(", ");
        await store.addEpisodes(userId, [
          { kind: "chat", titleImdbId: imdbId, text: `watching ${node.name}${where ? `: ${where}` : ""}` },
        ]);
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
