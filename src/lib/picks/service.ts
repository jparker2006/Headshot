/**
 * Tonight, end to end for one user: read the taste store, build the candidate
 * pool, run the engine, return the pick the chat opens with.
 *
 * v5 computes it on demand and stores nothing (SPEC v5, "Out of scope: a
 * nightly job"): there is no cron, no `tonight` table and no stored version to
 * invalidate — `pickNow` is the whole service.
 */
import type { IndustryGraph } from "@/lib/graph/engine";
import type { TmdbClient } from "@/lib/tmdb/client";
import type { TasteStore } from "@/lib/taste/types";
import { getTitles, type TitlesStore } from "@/lib/titles";
import { posterUrl } from "@/lib/titles/tmdb";
import type { TitleRow } from "@/lib/titles/types";
import { buildCandidates, type CandidateMeta } from "./candidates";
import { pickTonight, type Filters, type WatchedRow } from "./engine";
import { toPickView, type PickView } from "./view";

export interface TonightDeps {
  graph: IndustryGraph;
  tmdb: TmdbClient | null;
  store: TasteStore;
  /** The titles cache; a pick's ids are warmed into it. Absent = no warming. */
  titles?: TitlesStore | null;
  /**
   * Run the warm in the background (`waitUntil` in a route). The nightly job
   * leaves this unset, so the cache is filled before the run reports done.
   */
  schedule?: (work: () => Promise<void>) => void;
  log?: (m: string) => void;
}

/** Store rows as the engine reads them: the same state and score, no translation. */
export function toEngineRows(rows: Awaited<ReturnType<TasteStore["listWatched"]>>): WatchedRow[] {
  return rows.map((r) => ({ imdbId: r.titleImdbId, rating: r.rating, score: r.score, season: r.season, episodesWatched: r.episodesWatched }));
}

/** True when the user has told us enough to pick: at least one rated title. */
export async function hasTaste(store: TasteStore, userId: string): Promise<boolean> {
  const rows = await store.listWatched(userId);
  return rows.some((r) => r.rating === "rated" || r.rating === "want");
}

/**
 * Tonight, on demand (SPEC v5). The engine and `toPickView`, and nothing that
 * costs time or leaves a trace: no model call (the engine's own reason lines
 * stand), no stored row, no facts write, no titles warm. It runs when a chat
 * opens, so it has to be fast, and what it produces is a line in a
 * conversation, not state.
 */
export async function pickNow(
  deps: Pick<TonightDeps, "graph" | "tmdb" | "store" | "log" | "titles">,
  userId: string,
  filters: Filters | null = null,
): Promise<{ pick: PickView; picks: PickView[] } | null> {
  const { graph, store } = deps;
  const log = deps.log ?? (() => {});
  const rows = await store.listWatched(userId);
  const watched = toEngineRows(rows);
  if (!watched.some((w) => w.rating === "rated" || w.rating === "want")) return null;
  const servicesRow = await store.getServices(userId);
  const services = servicesRow?.providerIds ?? [];
  const region = servicesRow?.region ?? "US";
  const taste = await store.getTaste(userId);

  const pool = await buildCandidates({ graph, tmdb: deps.tmdb, watched, services, region, log });
  const result = pickTonight({ graph, watched, services, candidates: pool.candidates, taste: taste ? { vector: taste.vector, facts: taste.facts } : null, filters });
  if (!result.picks.length) return null;

  // A "continue" pick comes from the log, not the candidate pool, so the pool
  // has no poster or Play link for it (and without TMDB the pool has none for
  // anything). The titles cache does.
  const missing = result.picks.filter((p) => !pool.meta.get(p.imdbId)?.link).map((p) => p.imdbId);
  const meta = new Map(pool.meta);
  if (missing.length && deps.titles) {
    try {
      const titles = await getTitles(missing, { store: deps.titles, tmdb: deps.tmdb, graph, region, log });
      for (const [id, row] of titles) meta.set(id, { ...(meta.get(id) ?? {}), ...metaFromTitle(row) });
    } catch (err) {
      log(`[tonight] titles lookup failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  // The engine judged availability from the pool; a row the cache filled in
  // can say the title is on one of theirs after all.
  for (const p of result.picks) {
    if (!p.onYourServices && meta.get(p.imdbId)?.providers.some((x) => x.id !== undefined && services.includes(x.id))) p.onYourServices = true;
  }
  const picks = result.picks.map((p) => toPickView(p, meta.get(p.imdbId), services));
  // The opener leads with something playable when there is one.
  const pick = picks.find((p) => p.playUrl) ?? picks[0];
  return { pick, picks };
}

/** What the candidate pool would have carried, read from a cached titles row. */
function metaFromTitle(row: TitleRow): CandidateMeta {
  const providers = row.providers as { link?: string; flatrate?: { provider_id?: number; provider_name?: string }[] } | null;
  return {
    imdbId: row.imdbId,
    tmdbId: row.tmdbId ?? undefined,
    mediaType: row.kind === "series" ? "tv" : "movie",
    link: providers?.link,
    posterUrl: posterUrl(row) ?? undefined,
    providers: (providers?.flatrate ?? []).filter((p) => p.provider_name).map((p) => ({ id: p.provider_id, name: p.provider_name! })),
  };
}
