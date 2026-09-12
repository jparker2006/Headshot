/**
 * The pure rules behind a claim row on You (SPEC v5.3 → "Memory you can
 * read"). The page draws; this decides what is in a row, so
 * `tests/client/claimRows.test.ts` can hold the cuts to account without React.
 *
 * A claim is one belief with the log rows that prove it. The evidence is
 * ordered by the score the user gave — the best proof first — and capped, so a
 * claim never turns into a shelf.
 */
import type { Claim, ClaimPolarity, MemoryClaims } from "@/lib/taste/types";

export type { Claim, ClaimPolarity, MemoryClaims };

/** At most five marks under a claim; three is the usual number. */
export const CLAIM_EVIDENCE = 5;
/** A claim's text is at most twelve words — the rewrite's own cap, held again here. */
export const CLAIM_WORDS = 12;

/**
 * The evidence, best first: score descending, a row with no score last, ties
 * in the order the rewrite gave them. Capped at five.
 */
export function orderEvidence(
  ids: readonly string[],
  scores: Readonly<Record<string, number | null | undefined>>,
  limit = CLAIM_EVIDENCE,
): string[] {
  return ids
    .map((id, at) => ({ id, at, score: scores[id] ?? null }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.at - b.at)
    .slice(0, Math.max(0, limit))
    .map((e) => e.id);
}

/** The mono tag beside a claim, or null when there is nothing to say. */
export function claimTag(polarity: ClaimPolarity): string | null {
  return polarity === "avoid" ? "avoid" : null;
}

/** The ink a claim's text is set in: what you love reads loud, what you avoid reads quiet. */
export function claimInk(polarity: ClaimPolarity): string {
  return polarity === "avoid" ? "text-ink-dim" : "text-ink";
}

/** A claim's text, cut to twelve words with an ellipsis when the rewrite ran long. */
export function truncateClaim(text: string, words = CLAIM_WORDS): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= words) return parts.join(" ");
  return `${parts.slice(0, words).join(" ")}…`;
}

/**
 * What the page draws: every claim that still has evidence and that the user
 * has not just said "not me" to. The rejection is optimistic — the row goes
 * the moment it is tapped, and the rewrite makes it permanent.
 */
export function visibleClaims(claims: readonly Claim[] | null | undefined, rejectedIds: Iterable<string> = []): Claim[] {
  const gone = new Set(rejectedIds);
  return (claims ?? []).filter((c) => !gone.has(c.id) && c.text.trim() !== "" && c.evidence.length > 0);
}
