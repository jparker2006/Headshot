/**
 * The TMDB half of the titles cache: one IMDb id in, the fields the graph
 * cannot supply out. Never throws — a TMDB failure leaves the graph-only row
 * with `fetchedAt` null, so the next caller retries.
 */
import type { TmdbClient } from "@/lib/tmdb/client";
import { imageUrl } from "@/lib/tmdb/client";
import type { TitleRow } from "./types";

/** What one details pass adds to a graph-only row. */
export type TmdbTitleFacts = Pick<TitleRow, "tmdbId" | "kind" | "runtime" | "seasons" | "genres" | "posterPath" | "providers"> & {
  /** TMDB's own name/year, used only when the graph had none. */
  name: string;
  year: number | null;
};

/**
 * Three calls: find-by-imdb-id, details (a series' seasons ride along), and
 * the region's watch providers. Returns null when TMDB does not know the id.
 */
export async function fetchTitleFacts(
  tmdb: TmdbClient,
  imdbId: string,
  opts: { region?: string; hint?: { kind: "movie" | "series"; tmdbId: number | null } } = {},
): Promise<TmdbTitleFacts | null> {
  // The graph is the authority on what a title is and, when it carries one,
  // which TMDB id it has. TMDB's /find can answer a series id with a movie
  // (Fleabag, tt5687612 → a stage recording), so a graph hint wins over it.
  let found: { tmdbId: number; mediaType: "movie" | "tv" } | null = null;
  const hintedType = opts.hint ? (opts.hint.kind === "series" ? "tv" : "movie") : null;
  if (opts.hint?.tmdbId && hintedType) {
    found = { tmdbId: opts.hint.tmdbId, mediaType: hintedType };
  } else {
    const f = await tmdb.findByImdbId(imdbId, hintedType ?? undefined);
    if (!f || f.mediaType === "person") return null;
    found = { tmdbId: f.tmdbId, mediaType: f.mediaType };
  }
  const mediaType = found.mediaType;
  const facts = await tmdb.titleForCache(mediaType, found.tmdbId);
  if (!facts) return null;
  // A missing providers block is a fact about the title ("nowhere right now"),
  // not a failure: it is stored as null and not retried on its own.
  let providers: Record<string, unknown> | null = null;
  try {
    providers = (await tmdb.watchProviders(mediaType, found.tmdbId, opts.region ?? "US")) as Record<string, unknown> | null;
  } catch {
    providers = null;
  }
  return {
    tmdbId: found.tmdbId,
    kind: mediaType === "tv" ? "series" : "movie",
    name: facts.name,
    year: facts.year ?? null,
    runtime: facts.runtime ?? null,
    seasons: facts.seasons ?? null,
    genres: facts.genres,
    posterPath: facts.posterPath ?? null,
    providers,
  };
}

/** The poster URL for a cached row, or null when TMDB had no poster. */
export function posterUrl(row: Pick<TitleRow, "posterPath"> | undefined | null, size = "w342"): string | null {
  return row?.posterPath ? (imageUrl(row.posterPath, size) ?? null) : null;
}
