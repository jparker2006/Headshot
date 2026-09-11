/**
 * Tonight, end to end for one user: read the taste store, build the candidate
 * pool, run the engine, narrate the reason lines (one cheap model call,
 * optional), store the result, return what the screen renders. Called by the
 * nightly job and by an on-demand refresh; /api/tonight only reads.
 */
import type { LanguageModel } from "ai";
import type { IndustryGraph } from "@/lib/graph/engine";
import type { TmdbClient } from "@/lib/tmdb/client";
import type { TasteStore } from "@/lib/taste/types";
import { getTitles, type TitlesStore } from "@/lib/titles";
import { buildCandidates } from "./candidates";
import { pickTonight, tasteFacts, type Filters, type WatchedRow } from "./engine";
import { narrateReasons } from "./narrate";
import { toPickView, TONIGHT_VERSION, type TonightData } from "./view";

export interface TonightDeps {
  graph: IndustryGraph;
  tmdb: TmdbClient | null;
  store: TasteStore;
  /** Cheap model for reason lines; absent = the engine's own lines. */
  model?: LanguageModel | null;
  /** The titles cache; a pick's ids are warmed into it. Absent = no warming. */
  titles?: TitlesStore | null;
  /**
   * Run the warm in the background (`waitUntil` in a route). The nightly job
   * leaves this unset, so the cache is filled before the run reports done.
   */
  schedule?: (work: () => Promise<void>) => void;
  log?: (m: string) => void;
}

export function toEngineRows(rows: Awaited<ReturnType<TasteStore["listWatched"]>>): WatchedRow[] {
  return rows.map((r) => ({ imdbId: r.titleImdbId, rating: r.rating, season: r.season, episodesWatched: r.episodesWatched }));
}

/** True when the user has told us enough to pick: at least one rated title. */
export async function hasTaste(store: TasteStore, userId: string): Promise<boolean> {
  const rows = await store.listWatched(userId);
  return rows.some((r) => r.rating === "liked" || r.rating === "want" || r.rating === "meh");
}

export async function computeTonight(deps: TonightDeps, userId: string, filters: Filters | null = null): Promise<TonightData | null> {
  const { graph, store } = deps;
  const log = deps.log ?? (() => {});
  const rows = await store.listWatched(userId);
  const watched = toEngineRows(rows);
  if (!watched.some((w) => w.rating === "liked" || w.rating === "want" || w.rating === "meh")) return null;
  const services = (await store.getServices(userId))?.providerIds ?? [];
  const region = (await store.getServices(userId))?.region ?? "US";
  const taste = await store.getTaste(userId);

  const pool = await buildCandidates({ graph, tmdb: deps.tmdb, watched, services, region, log });
  const result = pickTonight({ graph, watched, services, candidates: pool.candidates, taste: taste ? { vector: taste.vector, facts: taste.facts } : null, filters });

  if (deps.model && result.picks.length) {
    try {
      const lines = await narrateReasons(deps.model, result.picks);
      result.picks.forEach((p, i) => {
        p.reason = { ...p.reason, text: lines[i] ?? p.reason.text };
      });
    } catch (err) {
      log(`[tonight] narration failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Refresh the derived facts alongside, so the taste map and the rail stay current.
  const facts = tasteFacts(graph, watched);
  await store.setTaste(userId, { vector: taste?.vector ?? null, facts });

  const data: TonightData = {
    version: TONIGHT_VERSION,
    picks: result.picks.map((p) => toPickView(p, pool.meta.get(p.imdbId), services)),
    deck: result.deck.map((p) => toPickView(p, pool.meta.get(p.imdbId), services)),
    generatedAt: new Date().toISOString(),
    laterCount: rows.filter((r) => r.rating === "want").length,
  };
  await store.setTonight(userId, data as unknown as Record<string, unknown>);

  // Every pick and deck card is something Numbers, the posters and the log
  // table will want facts for, so a pick is where the cache warms cheapest.
  if (deps.titles) {
    const ids = [...data.picks, ...data.deck].map((p) => p.imdbId);
    const warm = async () => {
      await getTitles(ids, { store: deps.titles!, tmdb: deps.tmdb, graph, region, refreshStale: true, log });
    };
    if (deps.schedule) deps.schedule(warm);
    else await warm().catch((err) => log(`[tonight] titles warm failed: ${err instanceof Error ? err.message : err}`));
  }

  log(`[tonight] ${userId}: ${data.picks.length} picks, ${data.deck.length} in the deck, ${result.rejected.length} rejected`);
  return data;
}

/** What /api/tonight returns: the stored result, computed once if there is none yet. */
export async function loadTonight(deps: TonightDeps, userId: string): Promise<TonightData | null> {
  const stored = await deps.store.getTonight(userId);
  if (stored && (stored.data as { version?: number }).version === TONIGHT_VERSION) return stored.data as unknown as TonightData;
  return computeTonight(deps, userId);
}
