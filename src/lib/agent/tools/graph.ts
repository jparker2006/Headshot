/**
 * Deterministic graph tools. The agent never computes a path itself; these do.
 */
import { tool } from "ai";
import { z } from "zod";
import { TIER_STRONG, type PathSet } from "@/lib/graph";
import { type AgentContext, describe, toCanvasNode, touch } from "../context";
import type { NamedPath, PathsFound } from "../events";

const imdbId = z.string().regex(/^(nm|tt)\d+$/, "an IMDb id like nm0000102 or tt0112384");

export function graphTools(ctx: AgentContext) {
  const { graph } = ctx;

  const resolve = (id: string) => {
    const n = graph.idOf(id);
    if (n === undefined) throw new Error(`${id} is not in the graph. Use find_entities or expand_node first.`);
    return n;
  };

  /** Announce a chosen path: `chosen` first (resets any previous lighting), then hops, then focus. */
  const emitChosen = (tier: "strong" | "full", index: number, path: number[], reason: string) => {
    const ids = path.map((id) => graph.node(id).imdbId);
    ctx.emit("chosen", { from: ids[0], to: ids[ids.length - 1], tier, index, reason, path: { imdbIds: ids, names: path.map((id) => graph.node(id).name) } });
    const total = path.length - 1;
    for (let i = 0; i < total; i++) {
      const y = graph.node(path[i + 1]);
      ctx.emit("path-hop", { from: ids[i], to: ids[i + 1], via: y.kind === "title" ? y.name : null, index: i, total, tier });
    }
    ctx.emit("focus", { imdbIds: ids });
  };

  const namePaths = (set: PathSet | null) =>
    set
      ? {
          baconNumber: set.baconNumber,
          truncated: set.truncated,
          paths: set.paths.map<NamedPath>((p) => ({
            imdbIds: p.map((id) => graph.node(id).imdbId),
            names: p.map((id) => graph.node(id).name),
          })),
        }
      : null;

  return {
    shortest_path: tool({
      description:
        "Shortest chain of shared credits between two people (or titles). Runs the strong tier first (movies, miniseries, short series; no talk shows), then the full graph. baconNumber is simply the exact number of titles on the shortest full-graph path (degrees apart). Returns up to 20 tied shortest paths per tier so you can pick the most interesting one with highlight_path.",
      inputSchema: z.object({ from: imdbId, to: imdbId }),
      execute: async ({ from, to }) => {
        const a = resolve(from);
        const b = resolve(to);
        const r = graph.tieredPaths(a, b);
        const found: PathsFound = {
          from,
          to,
          baconNumber: r.full?.baconNumber ?? null,
          strong: namePaths(r.strong),
          full: namePaths(r.full),
          differ: r.differ,
        };
        // Everything on any returned path joins the brain.
        const ids = new Set<number>();
        for (const set of [r.strong, r.full]) for (const p of set?.paths ?? []) for (const id of p) ids.add(id);
        await touch(ctx, [...ids].map((id) => toCanvasNode(graph.node(id))));
        for (const set of [r.strong, r.full]) {
          for (const p of set?.paths ?? []) {
            for (let i = 0; i + 1 < p.length; i++) {
              const x = graph.node(p[i]);
              const y = graph.node(p[i + 1]);
              const [person, title] = x.kind === "person" ? [x, y] : [y, x];
              const tier = graph.neighbors(x.id).find((n) => n.id === y.id)?.tier ?? TIER_STRONG;
              ctx.emit("edge", { personImdbId: person.imdbId, titleImdbId: title.imdbId, tier });
            }
          }
        }
        ctx.emit("paths", found);
        // Light the best route immediately so the answer is visible before the model narrates.
        // Prefer the strong tier (real collaborations); the model may override with highlight_path.
        const autoTier: "strong" | "full" = r.strong ? "strong" : "full";
        const autoSet = autoTier === "strong" ? r.strong : r.full;
        if (autoSet?.paths[0]) {
          emitChosen(autoTier, 0, autoSet.paths[0], "Auto-selected: shortest route through real collaborations.");
          return { ...found, autoHighlighted: { tier: autoTier, index: 0 }, hint: "A path is already lit. Call highlight_path only if a different tied path is more interesting." };
        }
        return found;
      },
    }),

    highlight_path: tool({
      description:
        "Light up one of the paths returned by shortest_path on the canvas, hop by hop. Call this exactly once per answer with the path you are going to narrate, and say why you chose it if there were alternatives.",
      inputSchema: z.object({
        from: imdbId,
        to: imdbId,
        tier: z.enum(["strong", "full"]).describe("Which tier's path list you are choosing from"),
        index: z.number().int().min(0).describe("Index into that tier's paths array"),
        reason: z.string().describe("One sentence on why this path is the most interesting"),
      }),
      execute: async ({ from, to, tier, index, reason }) => {
        const r = graph.tieredPaths(resolve(from), resolve(to));
        const set = tier === "strong" ? r.strong : r.full;
        const path = set?.paths[index];
        if (!path) throw new Error(`No ${tier} path at index ${index}`);
        emitChosen(tier, index, path, reason);
        return { highlighted: path.map((id) => describe(graph.node(id))), reason };
      },
    }),

    common_neighbors: tool({
      description:
        "Nodes adjacent to both inputs. Two titles → the people in both. Two people → the titles they share (same as shared_credits). Use this for 'who was in both X and Y?'.",
      inputSchema: z.object({ a: imdbId, b: imdbId, limit: z.number().int().min(1).max(60).default(40) }),
      execute: async ({ a, b, limit }) => {
        const all = graph.commonNeighbors(resolve(a), resolve(b));
        const nodes = all.slice(0, limit);
        await touch(ctx, [graph.node(resolve(a)), graph.node(resolve(b)), ...nodes].map((n) => toCanvasNode(n)));
        for (const n of nodes) {
          for (const end of [a, b]) {
            const endNode = graph.node(resolve(end));
            const [person, title] = n.kind === "person" ? [n, endNode] : [endNode, n];
            ctx.emit("edge", { personImdbId: person.imdbId, titleImdbId: title.imdbId, tier: TIER_STRONG });
          }
        }
        ctx.emit("focus", { imdbIds: [a, b, ...nodes.map((n) => n.imdbId)] });
        return { common: nodes.map(describe), total: all.length, truncated: all.length > nodes.length };
      },
    }),

    shared_credits: tool({
      description: "Titles two people have both worked on. Empty array means they have never shared a credit in the graph.",
      inputSchema: z.object({ personA: imdbId, personB: imdbId }),
      execute: async ({ personA, personB }) => {
        const titles = graph.sharedCredits(resolve(personA), resolve(personB));
        await touch(ctx, [graph.node(resolve(personA)), graph.node(resolve(personB)), ...titles].map((n) => toCanvasNode(n)));
        for (const t of titles) {
          ctx.emit("edge", { personImdbId: personA, titleImdbId: t.imdbId, tier: TIER_STRONG });
          ctx.emit("edge", { personImdbId: personB, titleImdbId: t.imdbId, tier: TIER_STRONG });
        }
        ctx.emit("focus", { imdbIds: [personA, personB, ...titles.map((t) => t.imdbId)] });
        return { shared: titles.map(describe) };
      },
    }),

    neighborhood: tool({
      description: "A node's credits (for a person) or cast and crew (for a title) from the graph, sorted by prominence. Cheap; use to check what someone has been in before guessing.",
      inputSchema: z.object({ id: imdbId, limit: z.number().int().min(1).max(50).default(20) }),
      execute: async ({ id, limit }) => {
        const center = graph.node(resolve(id));
        const hood = graph.neighborhood(center.id, limit);
        await touch(ctx, [center, ...hood.map((h) => h.node)].map((n) => toCanvasNode(n)));
        for (const h of hood) {
          const [person, title] = center.kind === "person" ? [center, h.node] : [h.node, center];
          ctx.emit("edge", { personImdbId: person.imdbId, titleImdbId: title.imdbId, tier: h.tier });
        }
        return { center: describe(center), neighbors: hood.map((h) => `${describe(h.node)}${h.tier === TIER_STRONG ? "" : " (weak)"}`) };
      },
    }),
  };
}
