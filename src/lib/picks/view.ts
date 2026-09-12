/**
 * What a pick looks like once the things only TMDB knows are attached (the
 * Play link, the poster, the provider names). Computed on demand by `pickNow`
 * and read by the chat opener and the `tonight` tool; nothing is stored.
 */
import type { Pick } from "./engine";
import type { CandidateMeta } from "./candidates";

export interface PickView {
  imdbId: string;
  name: string;
  year: number;
  titleType: string;
  kind: "start" | "continue";
  reason: { text: string; viaImdbIds: string[] };
  /** "Play on Hulu" when it streams on one of yours; "Rent" when it only rents; null when unknown. */
  playLabel: string | null;
  /** TMDB's watch-providers link: the JustWatch page for the title in the user's region, which forwards to the service. Null when TMDB has none. */
  playUrl: string | null;
  onYourServices: boolean;
  providerNames: string[];
  posterUrl: string | null;
  progress?: { season: number; episodesWatched: number };
}

export function toPickView(pick: Pick, meta: CandidateMeta | undefined, services: number[]): PickView {
  const mine = (meta?.providers ?? []).filter((p) => p.id !== undefined && services.includes(p.id));
  const first = mine[0]?.name ?? null;
  const playLabel = pick.onYourServices && first ? `Play on ${first}` : pick.rentPrice ? `Rent${pick.rentPrice === "rent" ? "" : ` ${pick.rentPrice}`}` : meta?.link ? "Where to watch" : null;
  return {
    imdbId: pick.imdbId,
    name: pick.name,
    year: pick.year,
    titleType: pick.titleType,
    kind: pick.kind,
    reason: { text: pick.reason.text, viaImdbIds: pick.reason.viaImdbIds },
    playLabel,
    playUrl: meta?.link ?? null,
    onYourServices: pick.onYourServices,
    providerNames: (meta?.providers ?? []).map((p) => p.name),
    posterUrl: meta?.posterUrl ?? null,
    progress: pick.progress,
  };
}
