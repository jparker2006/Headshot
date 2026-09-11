import { getBrain } from "@/lib/brain";
import { getIndustryGraph } from "@/lib/graph";
import { tmdbFromEnv, type TmdbTitle } from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";

const titleCache = new Map<string, Promise<TmdbTitle | null>>();

/**
 * Roles along a path: for every person→title hop, what the person did on that
 * title ("as Lucius", "Director", "Writer").
 *
 * The packed graph (format v2) carries character names for every title in the
 * TMDB crawl, so those hops are answered in memory. Only the long tail falls
 * through to a live TMDB credits lookup.
 * Query: ?path=nm1,tt1,nm2,tt2,nm3
 */
export async function GET(req: Request): Promise<Response> {
  const path = (new URL(req.url).searchParams.get("path") ?? "").split(",").filter((s) => /^(nm|tt)\d+$/.test(s)).slice(0, 15);
  if (path.length < 2) return Response.json({ roles: {} });
  const roles: Record<string, string> = {};

  // Hops the packed character table already knows.
  const unresolved: [nm: string, tt: string][] = [];
  const graph = await getIndustryGraph().catch(() => null);
  for (let i = 0; i < path.length; i++) {
    const tt = path[i];
    if (!tt.startsWith("tt")) continue;
    for (const nm of [path[i - 1], path[i + 1]].filter((x): x is string => !!x && x.startsWith("nm"))) {
      const personId = graph?.idOf(nm);
      const titleId = graph?.idOf(tt);
      const character = graph && personId !== undefined && titleId !== undefined ? graph.character(personId, titleId) : null;
      if (character) roles[`${nm}|${tt}`] = `as ${character.replace(/\s*\(voice\)/i, " (voice)")}`;
      else unresolved.push([nm, tt]);
    }
  }
  if (!unresolved.length) return Response.json({ roles }, { headers: { "cache-control": "public, max-age=3600" } });

  const tmdb = tmdbFromEnv();
  if (!tmdb) return Response.json({ roles }, { headers: { "cache-control": "public, max-age=3600" } });
  const brain = await getBrain();

  const titles = [...new Set(unresolved.map(([, tt]) => tt))];
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
      for (const [nm] of unresolved.filter(([, id]) => id === tt)) {
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
