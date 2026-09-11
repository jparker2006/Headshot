/**
 * Headshots for people, server-side: the same two-step `/api/enrich` uses —
 * the brain's cached node first, then one TMDB `find` per person, written back
 * so it is never fetched twice.
 *
 * Numbers' people grid needs faces on the server (the route answers with them
 * inline rather than making the client fan out to `/api/enrich`), and it wants
 * `known_for_department` at the same time, which the same lookup already
 * returns.
 */
import type { Brain } from "@/lib/brain/types";
import type { TmdbClient } from "./client";

export interface Face {
  url: string | null;
  /** TMDB's `known_for_department` ("Acting", "Directing", "Writing"). */
  knownAs?: string;
  tmdbId?: number;
}

export interface PersonFacesDeps {
  brain: Brain | null;
  tmdb: TmdbClient | null;
}

/**
 * Faces for these IMDb person ids, keyed by id. A person TMDB cannot place
 * comes back as `{ url: null }` rather than being dropped, so the caller can
 * render a placeholder without a second pass.
 */
export async function personFaces(ids: string[], deps: PersonFacesDeps): Promise<Record<string, Face>> {
  const wanted = [...new Set(ids.filter((id) => /^nm\d+$/.test(id)))];
  const out: Record<string, Face> = {};
  if (wanted.length === 0) return out;

  await Promise.all(
    wanted.map(async (id) => {
      try {
        const node = await deps.brain?.getNode(id);
        if (node?.posterUrl) {
          out[id] = { url: node.posterUrl, knownAs: node.knownAs, tmdbId: node.tmdbId };
          return;
        }
        if (!deps.tmdb) {
          out[id] = { url: null, knownAs: node?.knownAs };
          return;
        }
        const found = await deps.tmdb.imageFor(id);
        out[id] = { url: found?.imageUrl ?? null, knownAs: found?.knownAs ?? node?.knownAs, tmdbId: found?.tmdbId };
        if (node && found) {
          await deps.brain?.updateNode(id, { tmdbId: found.tmdbId, posterUrl: found.imageUrl, knownAs: found.knownAs });
        }
      } catch {
        out[id] = { url: null };
      }
    }),
  );
  return out;
}
