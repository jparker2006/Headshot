/**
 * What the agent knows about the signed-in user before the first tool call:
 * a compact block for the system prompt built from the taste store. Cheap
 * (two reads), explicit-only (nothing inferred), and absent when signed out.
 */
import type { IndustryGraph } from "@/lib/graph/engine";
import type { TasteStore } from "@/lib/taste/types";
import { providerName } from "@/lib/taste/providers";
import { tasteFacts } from "@/lib/picks/engine";
import { toEngineRows } from "@/lib/picks/service";
import { isLiked, isMeh } from "@/lib/taste/score";

export interface TasteSummary {
  /** `liked` is score >= 7 and `meh` is score <= 6; the words are the model's, the rule is the score. */
  counts: { liked: number; meh: number; want: number; unseen: number };
  services: string[];
  people: { name: string; count: number }[];
  eras: Record<string, number>;
  tvShare: number | null;
  avgRuntimeFinished: number | null;
  genresAvoided: string[];
  /** Most recently rated titles, newest first, with the score they gave (one decimal). */
  recent: { name: string; year: number; score: number | null }[];
  /** Titles marked "want" (Later), newest first. */
  later: { name: string; year: number }[];
  /** Series the user is in the middle of. */
  watching: { name: string; season: number; episodesWatched: number }[];
}

export async function tasteSummary(graph: IndustryGraph, store: TasteStore, userId: string): Promise<TasteSummary | null> {
  const rows = await store.listWatched(userId);
  const services = (await store.getServices(userId))?.providerIds ?? [];
  if (rows.length === 0 && services.length === 0) return null;
  const stored = await store.getTaste(userId);
  const facts = stored?.facts ?? tasteFacts(graph, toEngineRows(rows));
  const name = (id: string) => graph.nodeByImdbId(id)?.name ?? id;
  const year = (id: string) => graph.nodeByImdbId(id)?.year ?? 0;
  const byRecent = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    counts: {
      liked: rows.filter((r) => isLiked(r)).length,
      meh: rows.filter((r) => isMeh(r)).length,
      want: rows.filter((r) => r.rating === "want").length,
      unseen: rows.filter((r) => r.rating === "unseen").length,
    },
    services: services.map((id) => providerName(id) ?? String(id)),
    people: facts.people.slice(0, 8),
    eras: facts.eras,
    tvShare: facts.tvShare,
    avgRuntimeFinished: facts.avgRuntimeFinished,
    genresAvoided: facts.genresAvoided,
    recent: byRecent
      .filter((r) => r.rating === "rated")
      .slice(0, 20)
      .map((r) => ({ name: name(r.titleImdbId), year: year(r.titleImdbId), score: r.score })),
    later: byRecent
      .filter((r) => r.rating === "want")
      .slice(0, 12)
      .map((r) => ({ name: name(r.titleImdbId), year: year(r.titleImdbId) })),
    watching: rows.filter((r) => r.season != null).map((r) => ({ name: name(r.titleImdbId), season: r.season!, episodesWatched: r.episodesWatched })),
  };
}

/** The prompt block. Short, factual, in the order the model needs it. */
export function formatTasteContext(t: TasteSummary): string {
  const decades = Object.entries(t.eras)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d, n]) => `${d} (${n})`)
    .join(", ");
  const lines = [
    `This user is signed in and has told you their taste (explicit ratings only; never infer beyond them):`,
    `- Rated 1-10: ${t.counts.liked} at 7 or more, ${t.counts.meh} at 6 or less, ${t.counts.unseen} never seen, ${t.counts.want} in Later.`,
    t.services.length ? `- Pays for: ${t.services.join(", ")}.` : `- Streaming services: unknown.`,
    t.people.length ? `- Keeps watching (people across the titles they rated 7+): ${t.people.map((p) => `${p.name} (${p.count})`).join(", ")}.` : "",
    decades ? `- Decades they like: ${decades}.` : "",
    t.tvShare !== null ? `- TV share of what they watched: ${Math.round(t.tvShare * 100)}%.` : "",
    t.genresAvoided.length ? `- Genres only in their 6-and-under pile: ${t.genresAvoided.join(", ")}.` : "",
    t.recent.length ? `- Recently rated: ${t.recent.map((r) => `${r.name}${r.year ? ` (${r.year})` : ""} → ${r.score ?? "?"}/10`).join("; ")}.` : "",
    t.later.length ? `- Later list: ${t.later.map((r) => r.name).join(", ")}.` : "",
    t.watching.length ? `- Mid-series: ${t.watching.map((w) => `${w.name} (season ${w.season}, ${w.episodesWatched} episodes in)`).join("; ")}.` : "",
    `Use this when they ask what they like, whether they would like something, or what to watch. For "what should I watch tonight" call the tonight tool, with any runtime, energy, service, kind (film or show) or genre they mentioned; it already excludes anything they have logged. When they tell you they watched or rated something, call log with the score (7 and up is a like, 6 and under is not, and a decimal like 9.7 is kept exactly), with kind: "show" when they are talking about series and season when they said one. Answer in ordinary sentence case, first sentence first, and after logging give one line naming the titles and scores. Talk about their taste in specifics (names, titles, patterns), never in generic genre labels alone.`,
  ];
  return lines.filter(Boolean).join("\n");
}
