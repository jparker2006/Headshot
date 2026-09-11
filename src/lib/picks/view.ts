/**
 * What the Tonight screen renders: a pick plus the things only TMDB knows
 * (link for Play, poster, provider names). Stored by the nightly job and
 * returned by /api/tonight, so the client never recomputes anything.
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
  /** JustWatch page for the title in the region; opens the service. */
  playUrl: string | null;
  onYourServices: boolean;
  providerNames: string[];
  posterUrl: string | null;
  progress?: { season: number; episodesWatched: number };
}

export interface TonightData {
  picks: PickView[];
  deck: PickView[];
  generatedAt: string;
  /** How many titles sit in Later (dismissed picks and the imported watchlist). */
  laterCount: number;
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
