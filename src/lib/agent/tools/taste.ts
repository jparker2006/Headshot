/**
 * Taste tools: the agent's hands on the signed-in user's private taste graph.
 * Present only when the request has a user; every write is explicit (the user
 * said it) and stored with source "chat".
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { AgentContext } from "../context";
import type { NodeInfo } from "@/lib/graph/engine";
import { describe } from "../context";
import { pickNow } from "@/lib/picks/service";
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
    my_profile: tool({
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
        "Log what the user just told you about a title: a score out of 10 (7 and up is a like, 6 and under is not; decimals are fine, 9.7 stays 9.7), or a state with no score — want (add to Later), seen (watched, no opinion), unseen (never seen). Only when they actually said it. Pass imdbId when you have it, otherwise query with the name and it resolves against the graph. Pass kind: \"show\" when the message is about series or seasons, and season when they said which season they are on. A title in a list of things they have seen, with no score, is seen: pass no score and no state and that is what it becomes. If the result is ambiguous, ask them once which of the candidates they meant.",
      inputSchema: z.object({
        imdbId: imdbTitle.optional(),
        query: z.string().optional().describe("The title's name, when you do not have its id."),
        kind: z.enum(["film", "show"]).optional().describe("Which one the user means when a name is both. Say show for a series, a season, or a list of shows."),
        score: z.number().min(1).max(10).optional().describe("Their rating out of 10, one decimal allowed. loved 9, liked 8, fine 6, didn't like 4, hated 2."),
        state: z.enum(["want", "seen", "unseen"]).optional(),
        season: z.number().int().min(1).optional().describe("The season they are on, when they said one (\"through season 4\")."),
        note: z.string().optional().describe("What they said about it, in their words."),
      }),
      execute: async ({ imdbId, query, kind, score, state, season, note }) => {
        const resolved = resolveTitle(ctx.graph, { imdbId, query, kind });
        if ("error" in resolved) return resolved;
        if ("ambiguous" in resolved) return resolved;
        const node = resolved.node;
        if (score != null && !isValidScore(score)) return { error: "score must be 1-10, at most one decimal" };
        // No score and no state is not a question: in a list of things they
        // have seen, a bare title means they saw it (SPEC v5.1).
        const write: { rating: WatchedRating; score: number | null } = score != null ? { rating: "rated", score } : { rating: (state ?? "seen") as WatchedRating, score: null };
        await store.upsertWatched(userId, [{ titleImdbId: node.imdbId, ...write, source: "chat" }]);
        if (season != null) await store.setProgress(userId, node.imdbId, { season });
        // Every write is evidence: the memory rewrite reads episodes, not rows.
        const said = note?.trim() ? `: "${note.trim()}"` : "";
        const where = season != null ? ` (season ${season})` : "";
        await store.addEpisodes(userId, [
          {
            kind: "chat",
            titleImdbId: node.imdbId,
            text: write.rating === "rated" ? `rated ${node.name}${node.year ? ` (${node.year})` : ""} ${write.score}/10${where}${said}` : `${VERB[write.rating]} ${node.name}${node.year ? ` (${node.year})` : ""}${where}${said}`,
          },
        ]);
        return { ok: true, title: describe(node), state: write.rating, score: write.score, kind: titleKind(node), ...(season != null ? { season } : {}) };
      },
    }),

    tonight: tool({
      description:
        "What they should watch tonight: the pick engine run on demand over their log and services, with one real reason each and where it streams. Use for 'what should I watch' and pass whatever they said — a time budget, the energy they have, a service, a kind (film or show), a genre. It only returns things they have never logged, so 'a drama I haven't seen' is kind + genre and nothing else. Narrate the results in your voice; never invent a pick of your own.",
      inputSchema: z.object({
        maxRuntimeMin: z.number().int().min(1).optional().describe("A time budget in minutes, when they gave one ('I have two hours')."),
        energy: z.enum(["light", "heavy", "any"]).optional().describe("light = easy watch, heavy = demanding; omit when they did not say."),
        service: z.string().optional().describe("Only things on this service, when they named one ('something on Netflix')."),
        kind: z.enum(["film", "show"]).optional().describe("film for a movie, show for a series, when they asked for one ('a show I haven't seen')."),
        genre: z.string().optional().describe("One genre they asked for, as the industry names it: Drama, Comedy, Thriller, Horror, Documentary."),
        unseen: z.boolean().optional().describe("Default true: nothing they already have a row for. Pass false only when they want their Later list back."),
      }),
      execute: async ({ maxRuntimeMin, energy, service, kind, genre, unseen }) => {
        const result = await pickNow({ graph: ctx.graph, tmdb: ctx.tmdb, store }, userId, {
          ...(maxRuntimeMin ? { maxRuntimeMin } : {}),
          ...(energy ? { energy } : {}),
          ...(kind ? { kind } : {}),
          ...(genre ? { genre } : {}),
          ...(unseen === false ? { unseen: false } : {}),
        });
        if (!result) return { empty: true, hint: "No picks yet: they need at least one rated title. Suggest logging a few favourites or a Letterboxd import." };
        const wanted = service?.trim().toLowerCase();
        // A named service filters the picks rather than the pool: the engine's
        // ranking still decides, we only drop what does not stream there.
        const picks = (wanted ? result.picks.filter((p) => p.providerNames.some((n) => n.toLowerCase().includes(wanted))) : result.picks).slice(0, 3);
        if (!picks.length) return { empty: true, service: service ?? null, kind: kind ?? null, genre: genre ?? null, hint: wanted ? `Nothing tonight is on ${service}. Say so and offer the picks that are not.` : "Nothing fit those filters. Say so and offer to loosen them." };
        return {
          picks: picks.map((p) => ({
            imdbId: p.imdbId,
            title: `${p.name}${p.year ? ` (${p.year})` : ""}`,
            kind: p.kind,
            reason: p.reason.text,
            play: p.playLabel,
            playUrl: p.playUrl,
            providers: p.providerNames,
          })),
        };
      },
    }),
  };
}

/** film | show, from the graph's title type. */
export function titleKind(node: NodeInfo): "film" | "show" {
  return node.titleType === "tvSeries" || node.titleType === "tvMiniSeries" ? "show" : "film";
}

/** One candidate the model can ask about. */
export interface TitleCandidate {
  imdbId: string;
  name: string;
  year: number;
  kind: "film" | "show";
}

/**
 * Resolving a title the user named (SPEC v5.1, "log tool kind hint"). An id
 * wins outright. Otherwise the name is searched, the asked `kind` is preferred
 * when it matches anything, and a name that two strong titles of that kind
 * both answer to comes back `ambiguous` so the model asks once instead of
 * logging the wrong one. "Strong" is numeric: an exact (case-insensitive) name
 * match with at least a tenth of the top candidate's votes.
 */
export function resolveTitle(
  graph: AgentContext["graph"],
  input: { imdbId?: string; query?: string; kind?: "film" | "show" },
): { node: NodeInfo } | { ambiguous: true; candidates: TitleCandidate[] } | { error: string; query: string | null } {
  if (input.imdbId) {
    const node = graph.nodeByImdbId(input.imdbId);
    return node && node.kind === "title" ? { node } : { error: "unknown_title", query: input.imdbId };
  }
  const query = (input.query ?? "").trim();
  const found = graph.searchByName(query, 12, "title");
  if (!found.length) return { error: "unknown_title", query: query || null };
  const ofKind = input.kind ? found.filter((n) => titleKind(n) === input.kind) : found;
  const pool = ofKind.length ? ofKind : found;
  const q = query.toLowerCase();
  const exact = pool.filter((n) => n.name.toLowerCase() === q);
  if (exact.length > 1) {
    const top = Math.max(...exact.map((n) => n.votes));
    const strong = exact.filter((n) => n.votes >= top * STRONG_VOTE_SHARE);
    if (strong.length > 1) {
      return {
        ambiguous: true,
        candidates: strong.slice(0, 4).map((n) => ({ imdbId: n.imdbId, name: n.name, year: n.year, kind: titleKind(n) })),
      };
    }
  }
  return { node: (exact[0] ?? pool[0])! };
}

/** How close a second exact-name match has to be before the name counts as ambiguous. */
const STRONG_VOTE_SHARE = 0.1;
