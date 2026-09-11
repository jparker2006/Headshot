import { waitUntil } from "@vercel/functions";
import { getBrain } from "@/lib/brain";
import { getIndustryGraph } from "@/lib/graph";
import { getTitles, getTitlesStore, posterUrl } from "@/lib/titles";
import { tmdbFromEnv } from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";

/**
 * Posters and headshots for a list of IMDb ids (the source behind
 * `useImages`). Title posters come from the v4 titles cache when it has them;
 * everything else falls back to the brain node, which costs at most two TMDB
 * calls per entity ever. Missing images come back as null so the client can
 * render a placeholder.
 */
export async function GET(req: Request): Promise<Response> {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^(nm|tt)\d+$/.test(s))
    .slice(0, 40);
  if (ids.length === 0) return Response.json({ images: {} });
  const [brain, titlesStore] = await Promise.all([getBrain(), getTitlesStore()]);
  const tmdb = tmdbFromEnv();
  const images: Record<string, { url: string | null; tmdbId?: number }> = {};

  const titleIds = ids.filter((id) => id.startsWith("tt"));
  const cached = await titlesStore.getMany(titleIds);
  for (const [id, row] of cached) {
    const url = posterUrl(row);
    if (url) images[id] = { url, tmdbId: row.tmdbId ?? undefined };
  }

  await Promise.all(
    ids.map(async (id) => {
      if (images[id]) return;
      const node = await brain.getNode(id);
      if (node?.posterUrl) {
        images[id] = { url: node.posterUrl, tmdbId: node.tmdbId };
        return;
      }
      if (!tmdb) {
        images[id] = { url: null };
        return;
      }
      try {
        const r = await tmdb.imageFor(id);
        images[id] = { url: r?.imageUrl ?? null, tmdbId: r?.tmdbId };
        if (node && r) await brain.updateNode(id, { tmdbId: r.tmdbId, posterUrl: r.imageUrl, knownAs: r.knownAs });
      } catch {
        images[id] = { url: null };
      }
    }),
  );
  // Whatever the cache missed is filled after the response, so the next
  // render of the same poster never touches TMDB.
  if (titleIds.length) {
    waitUntil(
      (async () => {
        const graph = await getIndustryGraph();
        await getTitles(titleIds, { store: titlesStore, tmdb, graph });
      })().catch((err) => console.warn("[titles] warm failed:", err)),
    );
  }
  return Response.json({ images }, { headers: { "cache-control": "public, max-age=3600" } });
}
