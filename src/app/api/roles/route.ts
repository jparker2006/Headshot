import { getBrain } from "@/lib/brain";
import { tmdbFromEnv, type TmdbTitle } from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";

const titleCache = new Map<string, Promise<TmdbTitle | null>>();

/**
 * Roles along a path: for every person→title hop, what the person did on that
 * title ("as Lucius", "Director", "Writer"). Reads TMDB credits once per title.
 * Query: ?path=nm1,tt1,nm2,tt2,nm3
 */
export async function GET(req: Request): Promise<Response> {
  const path = (new URL(req.url).searchParams.get("path") ?? "").split(",").filter((s) => /^(nm|tt)\d+$/.test(s)).slice(0, 15);
  const tmdb = tmdbFromEnv();
  if (!tmdb || path.length < 2) return Response.json({ roles: {} });
  const brain = await getBrain();
  const roles: Record<string, string> = {};

  const titles = [...new Set(path.filter((id) => id.startsWith("tt")))];
  await Promise.all(
    titles.map(async (tt) => {
      let p = titleCache.get(tt);
      if (!p) {
        p = (async () => {
          const found = await tmdb.findByImdbId(tt);
          if (!found || found.mediaType === "person") return null;
          return tmdb.title(found.mediaType, found.tmdbId);
        })();
        titleCache.set(tt, p);
      }
      const t = await p;
      if (!t) return;
      // People adjacent to this title on the path.
      const idx = path.indexOf(tt);
      for (const nm of [path[idx - 1], path[idx + 1]].filter((x): x is string => !!x && x.startsWith("nm"))) {
        const node = await brain.getNode(nm);
        const byId = node?.tmdbId ? t.cast.find((c) => c.tmdbId === node.tmdbId) : undefined;
        const byName = node ? t.cast.find((c) => c.name.toLowerCase() === node.name.toLowerCase()) : undefined;
        const cast = byId ?? byName;
        if (cast?.character) {
          roles[`${nm}|${tt}`] = `as ${cast.character.replace(/\s*\(voice\)/i, " (voice)")}`;
          continue;
        }
        const crew = t.crew.find((c) => (node?.tmdbId && c.tmdbId === node.tmdbId) || (node && c.name.toLowerCase() === node.name.toLowerCase()));
        if (crew) roles[`${nm}|${tt}`] = crew.job === "Screenplay" || crew.job === "Story" ? "Writer" : crew.job;
      }
    }),
  );
  return Response.json({ roles }, { headers: { "cache-control": "public, max-age=3600" } });
}
