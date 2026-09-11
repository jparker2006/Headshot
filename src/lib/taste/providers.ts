/**
 * The services checklist. A short curated list rather than TMDB's full US
 * catalogue (1,000+ providers, mostly Amazon channels) — SPEC v3 asks for a
 * one-time checklist that takes six taps, not a directory.
 *
 * Ids verified against TMDB `/watch/providers/{movie,tv}?watch_region=US` on
 * 2026-09-11. Two notes from that check:
 *  - TMDB's display name for Apple TV+ is now plain "Apple TV" (350), and for
 *    Max it is "HBO Max" (1899). We keep the names people recognise.
 *  - Paramount+ is no longer 531 in the US list; the live subscription tier is
 *    2616 ("Paramount Plus Essential"), with 2303 for the Premium tier. We
 *    store 2616 and keep 531 as a legacy id so older rows still resolve.
 */
export interface Provider {
  /** TMDB watch-provider id, used verbatim in discover and watch/providers. */
  id: number;
  name: string;
  /** Ids TMDB used before and may still return for the same service. */
  legacyIds?: number[];
}

export const PROVIDERS: readonly Provider[] = [
  { id: 8, name: "Netflix" },
  { id: 9, name: "Prime Video" },
  { id: 1899, name: "Max" },
  { id: 337, name: "Disney+" },
  { id: 15, name: "Hulu" },
  { id: 350, name: "Apple TV+" },
  { id: 2616, name: "Paramount+", legacyIds: [531, 2303] },
  { id: 386, name: "Peacock" },
  { id: 258, name: "Criterion Channel" },
  { id: 11, name: "Mubi" },
  { id: 73, name: "Tubi" },
  { id: 192, name: "YouTube" },
];

const BY_ID = new Map<number, Provider>();
for (const p of PROVIDERS) {
  BY_ID.set(p.id, p);
  for (const legacy of p.legacyIds ?? []) BY_ID.set(legacy, p);
}

/** The display name for a stored provider id, legacy ids included. */
export function providerName(id: number): string | null {
  return BY_ID.get(id)?.name ?? null;
}

/** Drop ids that are not on the checklist, de-duplicated, in checklist order. */
export function normalizeProviderIds(ids: number[]): number[] {
  const kept = new Set<number>();
  for (const id of ids) {
    const p = BY_ID.get(id);
    if (p) kept.add(p.id);
  }
  return PROVIDERS.filter((p) => kept.has(p.id)).map((p) => p.id);
}
