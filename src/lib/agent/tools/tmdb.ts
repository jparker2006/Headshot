/**
 * Live TMDB tools: search, credits, person, and expand_node (which grows the
 * brain with nodes and overlay edges the industry graph lacks).
 */
import { tool } from "ai";
import { z } from "zod";
import { TIER_STRONG, type NodeKind } from "@/lib/graph/format";
import type { OverlayEdge } from "@/lib/graph/engine";
import { mediaTypeToTitleType } from "@/lib/tmdb/client";
import { type AgentContext, touch } from "../context";
import type { CanvasNode } from "../events";

const UNAVAILABLE = { error: "unavailable", hint: "TMDB is not configured; rely on the graph tools." } as const;

export function tmdbTools(ctx: AgentContext) {
  const { tmdb } = ctx;

  return {
    tmdb_search: tool({
      description:
        "Search TMDB for people, movies, and TV by name. Use when find_entities returns nothing or you need posters, bios, and 'known for' to disambiguate. Results carry TMDB ids, not IMDb ids; use tmdb_person / tmdb_title to get IMDb ids and credits.",
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: async ({ query }) => {
        if (!tmdb) return UNAVAILABLE;
        ctx.emit("status", { text: `Searching TMDB for "${query}"` }, { transient: true });
        const hits = await tmdb.searchMulti(query);
        return { hits };
      },
    }),

    tmdb_person: tool({
      description: "A person's TMDB profile: IMDb id, bio, and full credit list sorted by prominence. Use for fuzzy identification ('the bald guy from…') and for trivia when narrating.",
      inputSchema: z.object({ tmdbId: z.number().int() }),
      execute: async ({ tmdbId }) => {
        if (!tmdb) return UNAVAILABLE;
        const p = await tmdb.person(tmdbId);
        if (!p) return { error: "not_found" };
        return { ...p, biography: p.biography.slice(0, 600), credits: p.credits.slice(0, 40) };
      },
    }),

    tmdb_title: tool({
      description: "A movie or show's TMDB record: IMDb id, overview, poster, genres, top-billed cast and directors/writers.",
      inputSchema: z.object({ mediaType: z.enum(["movie", "tv"]), tmdbId: z.number().int() }),
      execute: async ({ mediaType, tmdbId }) => {
        if (!tmdb) return UNAVAILABLE;
        const t = await tmdb.title(mediaType, tmdbId);
        if (!t) return { error: "not_found" };
        return { ...t, overview: t.overview.slice(0, 600) };
      },
    }),

    expand_node: tool({
      description:
        "Live-crawl an entity's credits from TMDB into the brain so it (and its collaborators) exist as nodes with edges, even if the industry graph lacks them. Takes an IMDb id. Use for obscure people or new releases before calling shortest_path on them. Costs several TMDB calls; do not spam it.",
      inputSchema: z.object({ imdbId: z.string().regex(/^(nm|tt)\d+$/), limit: z.number().int().min(1).max(25).default(12) }),
      execute: async ({ imdbId, limit }) => {
        if (!tmdb) return UNAVAILABLE;
        ctx.emit("status", { text: `Expanding ${imdbId} from TMDB` }, { transient: true });
        const found = await tmdb.findByImdbId(imdbId);
        if (!found) return { error: "not_found" };

        const nodes: CanvasNode[] = [];
        const edges: OverlayEdge[] = [];

        if (found.mediaType === "person") {
          const p = await tmdb.person(found.tmdbId);
          if (!p) return { error: "not_found" };
          nodes.push(node(imdbId, p.name, "person", { posterUrl: p.profileUrl }));
          const top = p.credits.slice(0, limit);
          const ids = await Promise.all(top.map((c) => tmdb.titleImdbId(c.mediaType, c.tmdbId)));
          top.forEach((c, i) => {
            const tid = ids[i];
            if (!tid) return;
            nodes.push(node(tid, c.name, "title", { titleType: mediaTypeToTitleType(c.mediaType), year: c.year ?? 0, votes: c.voteCount }));
            edges.push({ personImdbId: imdbId, titleImdbId: tid, tier: TIER_STRONG });
          });
        } else {
          const t = await tmdb.title(found.mediaType, found.tmdbId);
          if (!t) return { error: "not_found" };
          nodes.push(node(imdbId, t.name, "title", { titleType: mediaTypeToTitleType(t.mediaType), year: t.year ?? 0, votes: t.voteCount, genres: t.genres.join(","), posterUrl: t.posterUrl }));
          const people = [...t.cast.slice(0, limit).map((c) => ({ tmdbId: c.tmdbId, name: c.name })), ...t.crew.map((c) => ({ tmdbId: c.tmdbId, name: c.name }))];
          const ids = await Promise.all(people.map((c) => tmdb.personImdbId(c.tmdbId)));
          people.forEach((c, i) => {
            const pid = ids[i];
            if (!pid) return;
            nodes.push(node(pid, c.name, "person", {}));
            edges.push({ personImdbId: pid, titleImdbId: imdbId, tier: TIER_STRONG });
          });
        }

        // Nodes already in the industry graph keep their packed identity.
        for (const n of nodes) n.inIndustryGraph = ctx.graph.nodeByImdbId(n.imdbId)?.overlay === false;
        await touch(ctx, nodes);
        await ctx.brain.addEdges(edges);
        for (const e of edges) ctx.emit("edge", e);
        // Refresh the engine's overlay so shortest_path can use the new edges immediately.
        ctx.graph.setOverlay(await ctx.brain.getOverlay());
        ctx.emit("focus", { imdbIds: [imdbId] });
        return { added: nodes.length, edges: edges.length, imdbIds: nodes.map((n) => `${n.name} [${n.imdbId}]`) };
      },
    }),
  };
}

function node(imdbId: string, name: string, kind: NodeKind, extra: Partial<CanvasNode>): CanvasNode {
  return { imdbId, name, kind, titleType: "", year: 0, votes: 0, genres: "", inIndustryGraph: false, ...extra };
}
