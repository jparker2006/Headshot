/**
 * TMDB v3 client with bearer auth. Pattern carried over from Cinema Daddy's
 * backend; nothing UI-facing. Every method returns typed, trimmed results and
 * never throws on "not found": it returns null so tools can report cleanly.
 */
import type { NodeKind, TitleType } from "@/lib/graph/format";

const BASE = "https://api.themoviedb.org/3";
const IMAGE = "https://image.tmdb.org/t/p";

export interface TmdbSearchHit {
  tmdbId: number;
  mediaType: "person" | "movie" | "tv";
  name: string;
  year?: number;
  knownFor?: string[];
  imageUrl?: string;
  popularity: number;
}

export interface TmdbCredit {
  tmdbId: number;
  mediaType: "movie" | "tv";
  name: string;
  year?: number;
  role: string;
  voteCount: number;
  imdbId?: string;
}

export interface TmdbPerson {
  tmdbId: number;
  imdbId?: string;
  name: string;
  biography: string;
  birthday?: string;
  knownForDepartment?: string;
  profileUrl?: string;
  credits: TmdbCredit[];
}

export interface TmdbTitle {
  tmdbId: number;
  imdbId?: string;
  mediaType: "movie" | "tv";
  name: string;
  year?: number;
  overview: string;
  posterUrl?: string;
  genres: string[];
  voteCount: number;
  cast: { tmdbId: number; name: string; character: string; order: number; imdbId?: string }[];
  crew: { tmdbId: number; name: string; job: string; imdbId?: string }[];
}

export interface Provider {
  /** TMDB watch-provider id (e.g. Netflix 8, Hulu 15, Max 1899). */
  id?: number;
  name: string;
  logoUrl?: string;
}

export interface DiscoverHit {
  tmdbId: number;
  mediaType: "movie" | "tv";
  name: string;
  year?: number;
  popularity: number;
  voteCount: number;
  posterUrl?: string;
}

export interface TitleFacts {
  tmdbId: number;
  mediaType: "movie" | "tv";
  rating: number;
  voteCount: number;
  runtime?: number;
  seasons?: number;
  tagline?: string;
  overview: string;
  posterUrl?: string;
  backdropUrl?: string;
  year?: number;
  genres: string[];
}

/**
 * What the v4 titles cache needs from one details call: the runtime (for a
 * series, the average episode runtime), the seasons with their episode counts,
 * genres, and the raw poster path (the cache stores paths, not URLs).
 */
export interface TitleCacheFacts {
  tmdbId: number;
  mediaType: "movie" | "tv";
  name: string;
  year?: number;
  runtime?: number;
  seasons?: { season: number; episodes: number }[];
  genres: string[];
  posterPath?: string;
}

export interface PersonFacts {
  tmdbId: number;
  biography: string;
  birthday?: string;
  deathday?: string;
  placeOfBirth?: string;
  knownForDepartment?: string;
  profileUrl?: string;
}

export interface TmdbClientOptions {
  bearerToken: string;
  fetch?: typeof fetch;
}

export class TmdbClient {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private cache = new Map<string, Promise<unknown>>();

  constructor(opts: TmdbClientOptions) {
    this.token = opts.bearerToken;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  private get<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
    const url = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const key = url.toString();
    const cached = this.cache.get(key);
    if (cached) return cached as Promise<T | null>;
    const p = (async () => {
      const res = await this.fetchImpl(key, {
        headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
      return (await res.json()) as T;
    })();
    this.cache.set(key, p);
    return p;
  }

  async searchMulti(query: string, limit = 8): Promise<TmdbSearchHit[]> {
    const data = await this.get<{ results: Record<string, unknown>[] }>("/search/multi", { query, include_adult: "false" });
    if (!data) return [];
    return data.results
      .filter((r) => ["person", "movie", "tv"].includes(String(r.media_type)))
      .slice(0, limit)
      .map((r) => {
        const mediaType = r.media_type as "person" | "movie" | "tv";
        const date = String(r.release_date ?? r.first_air_date ?? "");
        return {
          tmdbId: Number(r.id),
          mediaType,
          name: String(r.name ?? r.title ?? ""),
          year: date ? Number(date.slice(0, 4)) : undefined,
          knownFor: Array.isArray(r.known_for)
            ? (r.known_for as Record<string, unknown>[]).map((k) => String(k.title ?? k.name ?? "")).filter(Boolean)
            : undefined,
          imageUrl: imageUrl(String(r.profile_path ?? r.poster_path ?? "")),
          popularity: Number(r.popularity ?? 0),
        };
      });
  }

  /** Resolve an IMDb id to TMDB ids. */
  async findByImdbId(imdbId: string): Promise<{ tmdbId: number; mediaType: "person" | "movie" | "tv" } | null> {
    const data = await this.get<{
      movie_results: { id: number }[];
      tv_results: { id: number }[];
      person_results: { id: number }[];
    }>(`/find/${imdbId}`, { external_source: "imdb_id" });
    if (!data) return null;
    if (data.person_results?.[0]) return { tmdbId: data.person_results[0].id, mediaType: "person" };
    if (data.movie_results?.[0]) return { tmdbId: data.movie_results[0].id, mediaType: "movie" };
    if (data.tv_results?.[0]) return { tmdbId: data.tv_results[0].id, mediaType: "tv" };
    return null;
  }

  async person(tmdbId: number): Promise<TmdbPerson | null> {
    const data = await this.get<Record<string, unknown>>(`/person/${tmdbId}`, {
      append_to_response: "external_ids,combined_credits",
    });
    if (!data) return null;
    const ext = (data.external_ids ?? {}) as { imdb_id?: string };
    const cc = (data.combined_credits ?? {}) as { cast?: Record<string, unknown>[]; crew?: Record<string, unknown>[] };
    const credits: TmdbCredit[] = [];
    for (const c of cc.cast ?? []) credits.push(toCredit(c, String(c.character ? `as ${c.character}` : "cast")));
    for (const c of cc.crew ?? []) {
      const job = String(c.job ?? "");
      if (job === "Director" || job === "Writer" || job === "Screenplay" || job === "Story") credits.push(toCredit(c, job));
    }
    credits.sort((a, b) => b.voteCount - a.voteCount);
    return {
      tmdbId: Number(data.id),
      imdbId: ext.imdb_id || undefined,
      name: String(data.name ?? ""),
      biography: String(data.biography ?? ""),
      birthday: data.birthday ? String(data.birthday) : undefined,
      knownForDepartment: data.known_for_department ? String(data.known_for_department) : undefined,
      profileUrl: imageUrl(String(data.profile_path ?? "")),
      credits,
    };
  }

  async title(mediaType: "movie" | "tv", tmdbId: number): Promise<TmdbTitle | null> {
    const data = await this.get<Record<string, unknown>>(`/${mediaType}/${tmdbId}`, {
      append_to_response: "external_ids,credits",
    });
    if (!data) return null;
    const ext = (data.external_ids ?? {}) as { imdb_id?: string };
    const credits = (data.credits ?? {}) as { cast?: Record<string, unknown>[]; crew?: Record<string, unknown>[] };
    const date = String(data.release_date ?? data.first_air_date ?? "");
    return {
      tmdbId: Number(data.id),
      imdbId: (data.imdb_id as string | undefined) || ext.imdb_id || undefined,
      mediaType,
      name: String(data.title ?? data.name ?? ""),
      year: date ? Number(date.slice(0, 4)) : undefined,
      overview: String(data.overview ?? ""),
      posterUrl: imageUrl(String(data.poster_path ?? "")),
      genres: Array.isArray(data.genres) ? (data.genres as { name: string }[]).map((g) => g.name) : [],
      voteCount: Number(data.vote_count ?? 0),
      cast: (credits.cast ?? []).slice(0, 30).map((c) => ({
        tmdbId: Number(c.id),
        name: String(c.name ?? ""),
        character: String(c.character ?? ""),
        order: Number(c.order ?? 999),
      })),
      crew: (credits.crew ?? [])
        .filter((c) => ["Director", "Writer", "Screenplay", "Story"].includes(String(c.job)))
        .map((c) => ({ tmdbId: Number(c.id), name: String(c.name ?? ""), job: String(c.job) })),
    };
  }

  /** Lightweight image + id lookup for one IMDb id: 2 small calls, no credits. */
  async imageFor(imdbId: string): Promise<{ tmdbId: number; mediaType: "person" | "movie" | "tv"; imageUrl?: string; knownAs?: string } | null> {
    const found = await this.findByImdbId(imdbId);
    if (!found) return null;
    if (found.mediaType === "person") {
      const d = await this.get<Record<string, unknown>>(`/person/${found.tmdbId}`);
      return { ...found, imageUrl: imageUrl(String(d?.profile_path ?? "")), knownAs: d?.known_for_department ? String(d.known_for_department) : undefined };
    }
    const d = await this.get<Record<string, unknown>>(`/${found.mediaType}/${found.tmdbId}`);
    return { ...found, imageUrl: imageUrl(String(d?.poster_path ?? "")), knownAs: d?.tagline ? String(d.tagline) : undefined };
  }

  /** Official trailer (YouTube key) for a title, preferring official trailers, then any trailer, then a teaser. */
  async trailer(mediaType: "movie" | "tv", tmdbId: number): Promise<{ youtubeKey: string; name: string } | null> {
    const d = await this.get<{ results: { site: string; type: string; official: boolean; key: string; name: string }[] }>(`/${mediaType}/${tmdbId}/videos`);
    const yt = (d?.results ?? []).filter((v) => v.site === "YouTube");
    const pick =
      yt.find((v) => v.type === "Trailer" && v.official) ?? yt.find((v) => v.type === "Trailer") ?? yt.find((v) => v.type === "Teaser") ?? null;
    return pick ? { youtubeKey: pick.key, name: pick.name } : null;
  }

  /** Where to watch in a region: subscription, rent, buy, free-with-ads. */
  async watchProviders(mediaType: "movie" | "tv", tmdbId: number, region = "US"): Promise<{ link?: string; flatrate: Provider[]; rent: Provider[]; buy: Provider[]; ads: Provider[] } | null> {
    const d = await this.get<{ results: Record<string, Record<string, unknown>> }>(`/${mediaType}/${tmdbId}/watch/providers`);
    const r = d?.results?.[region];
    if (!r) return null;
    const list = (k: string): Provider[] =>
      Array.isArray(r[k])
        ? (r[k] as Record<string, unknown>[]).map((p) => ({ id: Number(p.provider_id), name: String(p.provider_name), logoUrl: imageUrl(String(p.logo_path ?? ""), "w92") }))
        : [];
    return { link: r.link ? String(r.link) : undefined, flatrate: list("flatrate"), rent: list("rent"), buy: list("buy"), ads: list("ads") };
  }

  /**
   * Titles streaming on the given providers in a region, most popular first.
   * One page (20) per call; the pick engine's "new on your services" pool.
   */
  async discoverByProviders(mediaType: "movie" | "tv", providerIds: number[], opts: { region?: string; page?: number; sort?: "popularity.desc" | "primary_release_date.desc" | "first_air_date.desc" } = {}): Promise<DiscoverHit[]> {
    if (providerIds.length === 0) return [];
    const d = await this.get<{ results: Record<string, unknown>[] }>(`/discover/${mediaType}`, {
      with_watch_providers: providerIds.join("|"),
      watch_region: opts.region ?? "US",
      with_watch_monetization_types: "flatrate",
      sort_by: opts.sort ?? "popularity.desc",
      page: String(opts.page ?? 1),
      "vote_count.gte": "200",
    });
    return (d?.results ?? []).map((r) => {
      const date = String(r.release_date ?? r.first_air_date ?? "");
      return {
        tmdbId: Number(r.id),
        mediaType,
        name: String(r.title ?? r.name ?? ""),
        year: date ? Number(date.slice(0, 4)) : undefined,
        popularity: Number(r.popularity ?? 0),
        voteCount: Number(r.vote_count ?? 0),
        posterUrl: imageUrl(String(r.poster_path ?? "")),
      };
    });
  }

  /** Title facts for a page: rating, runtime, tagline, overview, poster. Lighter than title(). */
  async titleFacts(mediaType: "movie" | "tv", tmdbId: number): Promise<TitleFacts | null> {
    const d = await this.get<Record<string, unknown>>(`/${mediaType}/${tmdbId}`);
    if (!d) return null;
    const date = String(d.release_date ?? d.first_air_date ?? "");
    return {
      tmdbId,
      mediaType,
      rating: Number(d.vote_average ?? 0),
      voteCount: Number(d.vote_count ?? 0),
      runtime: d.runtime ? Number(d.runtime) : Array.isArray(d.episode_run_time) && d.episode_run_time.length ? Number((d.episode_run_time as number[])[0]) : undefined,
      seasons: d.number_of_seasons ? Number(d.number_of_seasons) : undefined,
      tagline: d.tagline ? String(d.tagline) : undefined,
      overview: String(d.overview ?? ""),
      posterUrl: imageUrl(String(d.poster_path ?? "")),
      backdropUrl: imageUrl(String(d.backdrop_path ?? ""), "w780"),
      year: date ? Number(date.slice(0, 4)) : undefined,
      genres: Array.isArray(d.genres) ? (d.genres as { name: string }[]).map((g) => g.name) : [],
    };
  }

  /**
   * One details call for the titles cache. TV carries its seasons (with
   * episode counts) in the same payload, so no per-season call is needed;
   * specials (season 0) are dropped.
   */
  async titleForCache(mediaType: "movie" | "tv", tmdbId: number): Promise<TitleCacheFacts | null> {
    const d = await this.get<Record<string, unknown>>(`/${mediaType}/${tmdbId}`);
    if (!d) return null;
    const date = String(d.release_date ?? d.first_air_date ?? "");
    const runtimes = Array.isArray(d.episode_run_time) ? (d.episode_run_time as number[]).filter((n) => n > 0) : [];
    const seasons = Array.isArray(d.seasons)
      ? (d.seasons as Record<string, unknown>[])
          .map((s) => ({ season: Number(s.season_number), episodes: Number(s.episode_count ?? 0) }))
          .filter((s) => Number.isFinite(s.season) && s.season > 0)
          .sort((a, b) => a.season - b.season)
      : undefined;
    return {
      tmdbId,
      mediaType,
      name: String(d.title ?? d.name ?? ""),
      year: date ? Number(date.slice(0, 4)) : undefined,
      runtime: d.runtime
        ? Number(d.runtime)
        : runtimes.length
          ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length)
          : undefined,
      seasons: mediaType === "tv" ? (seasons ?? []) : undefined,
      genres: Array.isArray(d.genres) ? (d.genres as { name: string }[]).map((g) => g.name) : [],
      posterPath: d.poster_path ? String(d.poster_path) : undefined,
    };
  }

  /** Person facts for a page: bio, birthday, department, headshot. */
  async personFacts(tmdbId: number): Promise<PersonFacts | null> {
    const d = await this.get<Record<string, unknown>>(`/person/${tmdbId}`);
    if (!d) return null;
    return {
      tmdbId,
      biography: String(d.biography ?? ""),
      birthday: d.birthday ? String(d.birthday) : undefined,
      deathday: d.deathday ? String(d.deathday) : undefined,
      placeOfBirth: d.place_of_birth ? String(d.place_of_birth) : undefined,
      knownForDepartment: d.known_for_department ? String(d.known_for_department) : undefined,
      profileUrl: imageUrl(String(d.profile_path ?? "")),
    };
  }

  /** IMDb id for a TMDB person (one extra call). */
  async personImdbId(tmdbId: number): Promise<string | undefined> {
    const data = await this.get<{ imdb_id?: string }>(`/person/${tmdbId}/external_ids`);
    return data?.imdb_id || undefined;
  }

  /** IMDb id for a TMDB title (one extra call). */
  async titleImdbId(mediaType: "movie" | "tv", tmdbId: number): Promise<string | undefined> {
    const data = await this.get<{ imdb_id?: string }>(`/${mediaType}/${tmdbId}/external_ids`);
    return data?.imdb_id || undefined;
  }
}

function toCredit(c: Record<string, unknown>, role: string): TmdbCredit {
  const mediaType = c.media_type === "tv" ? "tv" : "movie";
  const date = String(c.release_date ?? c.first_air_date ?? "");
  return {
    tmdbId: Number(c.id),
    mediaType,
    name: String(c.title ?? c.name ?? ""),
    year: date ? Number(date.slice(0, 4)) : undefined,
    role,
    voteCount: Number(c.vote_count ?? 0),
  };
}

export function imageUrl(path: string, size = "w342"): string | undefined {
  return path ? `${IMAGE}/${size}${path}` : undefined;
}

export function mediaTypeToKind(m: "person" | "movie" | "tv"): NodeKind {
  return m === "person" ? "person" : "title";
}

export function mediaTypeToTitleType(m: "movie" | "tv"): TitleType {
  return m === "movie" ? "movie" : "tvSeries";
}

/** Client from env, or null when no token is configured (tools then report "unavailable"). */
export function tmdbFromEnv(): TmdbClient | null {
  const token = process.env.TMDB_BEARER_TOKEN;
  return token ? new TmdbClient({ bearerToken: token }) : null;
}
