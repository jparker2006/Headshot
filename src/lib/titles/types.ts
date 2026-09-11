/**
 * The titles cache: TMDB facts the industry graph does not carry (runtime,
 * seasons with episode counts, genres, poster, providers), keyed by IMDb id.
 *
 * Unlike the taste store this is not per-user data — it is a shared cache of
 * public facts — so it lives beside the brain's tables and is never cleared by
 * `deleteUser`. Two implementations, one conformance suite.
 */
import type { TitleSeason } from "@/lib/brain/schema";

export type { TitleSeason };

export interface TitleRow {
  imdbId: string;
  tmdbId: number | null;
  kind: "movie" | "series";
  name: string;
  year: number | null;
  /** Minutes. For a series, the average episode runtime. */
  runtime: number | null;
  seasons: TitleSeason[] | null;
  genres: string[];
  /** TMDB poster path ("/abc.jpg"), not a URL; `posterUrl()` builds the URL. */
  posterPath: string | null;
  /** The TMDB watch-providers payload, as fetched. */
  providers: Record<string, unknown> | null;
  /** ISO timestamp, or null when only the graph half is known (so it retries). */
  fetchedAt: string | null;
}

export interface TitlesStore {
  /** Cached rows for these ids; misses are simply absent from the map. */
  getMany(ids: string[]): Promise<Map<string, TitleRow>>;
  /** Insert or replace whole rows, keyed by IMDb id. */
  upsertMany(rows: TitleRow[]): Promise<void>;
}
