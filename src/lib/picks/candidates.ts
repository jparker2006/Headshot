/**
 * The candidate pool for the pick engine: unseen titles from the graph walk
 * (people on what you liked) plus what is streaming on your services right
 * now (TMDB discover), each with availability, the JustWatch link the Play
 * button opens, runtime, and poster. TMDB is optional: without it the pool
 * is the graph walk with unknown availability, which the engine ranks last.
 */
import type { IndustryGraph } from "@/lib/graph/engine";
import type { TmdbClient } from "@/lib/tmdb/client";
import { walkCandidates, type Candidate, type WatchedRow } from "./engine";

export interface CandidateMeta {
  imdbId: string;
  tmdbId?: number;
  mediaType?: "movie" | "tv";
  /** JustWatch page for the title in the region; the Play button's target. */
  link?: string;
  posterUrl?: string;
  providers: { id?: number; name: string }[];
}

export interface CandidatePool {
  candidates: Candidate[];
  meta: Map<string, CandidateMeta>;
}

export interface BuildOptions {
  graph: IndustryGraph;
  tmdb: TmdbClient | null;
  watched: WatchedRow[];
  services: number[];
  region?: string;
  /** Graph-walk pool size (default 40) and discover pool size (default 40). */
  walkLimit?: number;
  discoverLimit?: number;
  /** How many candidates get the extra runtime call (top by walk proximity; default 24). */
  factsLimit?: number;
  log?: (m: string) => void;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function buildCandidates(opts: BuildOptions): Promise<CandidatePool> {
  const { graph, tmdb, watched } = opts;
  const region = opts.region ?? "US";
  const log = opts.log ?? (() => {});
  const seen = new Set(watched.map((w) => w.imdbId));
  const walk = walkCandidates(graph, watched, { limit: opts.walkLimit ?? 40 });
  const pool = new Map<string, { fresh: boolean; proximity: number }>();
  for (const w of walk) pool.set(w.imdbId, { fresh: false, proximity: w.proximity });

  // New on your services: discover by provider, resolved to graph nodes by TMDB id.
  if (tmdb && opts.services.length) {
    const byTmdb = new Map<string, number>();
    for (let id = 0; id < graph.nodeCount; id++) {
      const n = graph.node(id);
      if (n.kind === "title" && n.tmdbId) byTmdb.set(`${n.titleType === "movie" ? "movie" : "tv"}:${n.tmdbId}`, id);
    }
    let added = 0;
    for (const mediaType of ["movie", "tv"] as const) {
      let hits: Awaited<ReturnType<TmdbClient["discoverByProviders"]>> = [];
      try {
        hits = await tmdb.discoverByProviders(mediaType, opts.services, { region });
      } catch (err) {
        log(`[candidates] discover ${mediaType} failed: ${err instanceof Error ? err.message : err}`);
      }
      for (const h of hits) {
        const id = byTmdb.get(`${mediaType}:${h.tmdbId}`);
        if (id === undefined) continue;
        const imdbId = graph.node(id).imdbId;
        if (seen.has(imdbId) || pool.has(imdbId)) continue;
        pool.set(imdbId, { fresh: true, proximity: 0 });
        if (++added >= (opts.discoverLimit ?? 40)) break;
      }
    }
  }

  const ids = [...pool.entries()].sort((a, b) => b[1].proximity - a[1].proximity).map(([id]) => id);
  const meta = new Map<string, CandidateMeta>();
  const candidates: Candidate[] = [];
  const factsLimit = opts.factsLimit ?? 24;

  const rows = await mapLimit(ids, 6, async (imdbId, ) => {
    const node = graph.nodeByImdbId(imdbId)!;
    const mediaType: "movie" | "tv" = node.titleType === "movie" ? "movie" : "tv";
    const m: CandidateMeta = { imdbId, tmdbId: node.tmdbId || undefined, mediaType, providers: [] };
    const c: Candidate = { imdbId, availableOn: [], fresh: pool.get(imdbId)!.fresh };
    if (!tmdb) return { c, m };
    try {
      if (!m.tmdbId) {
        const found = await tmdb.findByImdbId(imdbId);
        if (found && found.mediaType !== "person") {
          m.tmdbId = found.tmdbId;
          m.mediaType = found.mediaType;
        }
      }
      if (m.tmdbId) {
        const wp = await tmdb.watchProviders(m.mediaType!, m.tmdbId, region);
        if (wp) {
          m.link = wp.link;
          m.providers = wp.flatrate;
          c.availableOn = wp.flatrate.map((p) => p.id).filter((id): id is number => typeof id === "number");
          if (c.availableOn.length === 0 && (wp.rent.length || wp.buy.length)) c.rentPrice = "rent";
        }
        if (ids.indexOf(imdbId) < factsLimit) {
          const facts = await tmdb.titleFacts(m.mediaType!, m.tmdbId);
          if (facts) {
            c.runtimeMin = facts.runtime ?? null;
            m.posterUrl = facts.posterUrl;
          }
        }
      }
    } catch (err) {
      log(`[candidates] ${imdbId}: ${err instanceof Error ? err.message : err}`);
    }
    return { c, m };
  });
  for (const { c, m } of rows) {
    candidates.push(c);
    meta.set(c.imdbId, m);
  }
  log(`[candidates] ${candidates.length} (${walk.length} from the graph, ${candidates.filter((c) => c.fresh).length} new on your services)`);
  return { candidates, meta };
}
