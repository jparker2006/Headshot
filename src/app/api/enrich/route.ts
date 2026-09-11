import { getBrain } from "@/lib/brain";
import { tmdbFromEnv } from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";

/**
 * Posters and headshots for a list of IMDb ids. Cached on the brain node, so
 * each entity costs at most two TMDB calls ever. Missing images come back as
 * null so the client can render a placeholder.
 */
export async function GET(req: Request): Promise<Response> {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^(nm|tt)\d+$/.test(s))
    .slice(0, 40);
  if (ids.length === 0) return Response.json({ images: {} });
  const brain = await getBrain();
  const tmdb = tmdbFromEnv();
  const images: Record<string, { url: string | null; tmdbId?: number }> = {};

  await Promise.all(
    ids.map(async (id) => {
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
  return Response.json({ images }, { headers: { "cache-control": "public, max-age=3600" } });
}
