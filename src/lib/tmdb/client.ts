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
