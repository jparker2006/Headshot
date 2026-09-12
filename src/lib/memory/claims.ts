/**
 * SPEC v5.3: the memory as claims, not prose.
 *
 * The model proposes `{ sentence, claims: [{ text, evidence, polarity }] }`.
 * Nothing it proposes is trusted: `validateClaims` is a pure function that
 * checks every claim against the log rows the rewrite actually read, enforces
 * the caps, and carries the rejected list forward so a claim the user said
 * "not me" to can never come back in a new wording.
 *
 * `renderClaimsMarkdown` then renders the claims to the short markdown the
 * agent reads, deterministically — no model, no clock, no randomness.
 */
import { randomBytes } from "node:crypto";
import type { Claim, ClaimPolarity, MemoryClaims } from "@/lib/taste/types";

/** At most this many claims survive one rewrite. */
export const MAX_CLAIMS = 8;

/** Of those, at most this many may be `avoid`: a person is not their dislikes. */
export const MAX_AVOID = 2;

/** A claim is a phrase, not a paragraph. Longer is dropped, never truncated. */
export const MAX_CLAIM_WORDS = 12;

/** The one sentence at the top of You. Longer is truncated. */
export const MAX_SENTENCE_WORDS = 20;

/** The headings the rendered markdown uses, and the agent's prompt expects. */
export const LOVE_HEADING = "## What you love";
export const AVOID_HEADING = "## What you avoid";

/** What the raw model output looks like before anything is checked. */
export interface RawClaims {
  sentence?: unknown;
  claims?: unknown;
  [key: string]: unknown;
}

export interface ValidateContext {
  /** Every imdb id the log currently holds (`tt…`), plus the people ids the summary knows (`nm…`). */
  knownIds: Iterable<string>;
  /** The claims stored before this rewrite: ids are reused from here, and its `rejected` is carried forward. */
  previous?: MemoryClaims | null;
  /** Injectable for tests; defaults to crypto. */
  newId?: () => string;
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Bold markers never survive: the claim text is plain, the render adds the bold. */
function plain(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

function normalize(text: string): string {
  return plain(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** `c_` plus eight hex characters. Stable once assigned; reused when the text matches. */
function generateId(): string {
  return `c_${randomBytes(4).toString("hex")}`;
}

/**
 * Turn whatever the model returned into a `MemoryClaims` that is true of the
 * log, or into an empty one. Pure: everything it needs is in `ctx`.
 */
export function validateClaims(raw: RawClaims | null | undefined, ctx: ValidateContext): MemoryClaims {
  const known = new Set(ctx.knownIds);
  const previous = ctx.previous ?? null;
  const newId = ctx.newId ?? generateId;

  // The user's "not me" list is the store's, not the model's: it is carried
  // forward untouched and it is the first filter every claim goes through.
  const rejected = dedupeRejected(previous?.rejected ?? []);
  const rejectedKeys = rejected.map((r) => normalize(r.text)).filter(Boolean);

  const previousById = new Map<string, Claim>();
  for (const claim of previous?.claims ?? []) previousById.set(normalize(claim.text), claim);

  const usedIds = new Set<string>();
  const out: Claim[] = [];
  let avoid = 0;
  const seen = new Set<string>();

  for (const entry of Array.isArray(raw?.claims) ? raw!.claims : []) {
    if (out.length >= MAX_CLAIMS) break;
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as { text?: unknown; evidence?: unknown; polarity?: unknown };

    const text = typeof candidate.text === "string" ? plain(candidate.text) : "";
    if (!text) continue;
    // Too long is dropped rather than cut: half a claim is a different claim.
    if (words(text).length > MAX_CLAIM_WORDS) continue;

    const key = normalize(text);
    if (!key || seen.has(key)) continue;
    // Either direction counts: "slow burns" must not come back as "loves slow
    // burns, whatever the genre" after the user said no to it.
    if (rejectedKeys.some((r) => key.includes(r) || r.includes(key))) continue;

    // Evidence must be rows. An id the log no longer holds is dropped, and a
    // claim with nothing left to point at is not a claim.
    const evidence: string[] = [];
    for (const id of Array.isArray(candidate.evidence) ? candidate.evidence : []) {
      if (typeof id !== "string") continue;
      if (!known.has(id) || evidence.includes(id)) continue;
      evidence.push(id);
    }
    if (evidence.length === 0) continue;

    const polarity: ClaimPolarity = candidate.polarity === "avoid" ? "avoid" : "love";
    if (polarity === "avoid") {
      if (avoid >= MAX_AVOID) continue;
      avoid++;
    }

    // Ids are stable across rewrites so a "not me" and a render agree on what
    // a row is: same text, same id.
    let id = previousById.get(key)?.id;
    if (!id || usedIds.has(id)) {
      do {
        id = newId();
      } while (usedIds.has(id));
    }
    usedIds.add(id);
    seen.add(key);
    out.push({ id, text, evidence, polarity });
  }

  return { sentence: capSentence(typeof raw?.sentence === "string" ? raw.sentence : ""), claims: out, rejected };
}

/** The sentence: no bold, and truncated (not dropped) at the word cap. */
export function capSentence(sentence: string): string {
  const w = words(plain(sentence));
  return w.length <= MAX_SENTENCE_WORDS ? w.join(" ") : w.slice(0, MAX_SENTENCE_WORDS).join(" ");
}

function dedupeRejected(rows: { text: string }[]): { text: string }[] {
  const out: { text: string }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const text = typeof row?.text === "string" ? plain(row.text) : "";
    const key = normalize(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ text });
  }
  return out;
}

/** What the renderer needs to know about one evidence id. */
export interface EvidenceLookup {
  (imdbId: string): { name: string; score?: number | null } | undefined;
}

/** One decimal, and only when there is a decimal: 9 is 9, 9.7 is 9.7. */
function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/**
 * The claims as the markdown the agent reads and `memoryText` returns:
 *
 *   one sentence about them
 *
 *   ## What you love
 *   Crime with a long fuse: **Breaking Bad** 9.9, **The Sopranos** 10.
 *
 * Evidence is ordered by score descending (people, which carry no score, come
 * last in the order the claim gave them). Deterministic for a given input.
 */
export function renderClaimsMarkdown(claims: MemoryClaims, lookup: EvidenceLookup): string {
  const section = (polarity: ClaimPolarity, heading: string): string[] => {
    const rows = claims.claims.filter((c) => c.polarity === polarity);
    if (!rows.length) return [];
    return [heading, ...rows.map((claim) => renderClaim(claim, lookup))];
  };
  const blocks = [
    claims.sentence ? [claims.sentence] : [],
    section("love", LOVE_HEADING),
    section("avoid", AVOID_HEADING),
  ].filter((b) => b.length);
  return blocks.map((b) => b.join("\n")).join("\n\n");
}

function renderClaim(claim: Claim, lookup: EvidenceLookup): string {
  const resolved = claim.evidence.map((id, index) => {
    const hit = lookup(id);
    return { index, name: hit?.name ?? id, score: typeof hit?.score === "number" ? hit.score : null };
  });
  resolved.sort((a, b) => {
    if (a.score === b.score) return a.index - b.index;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });
  const evidence = resolved.map((e) => `**${e.name}**${e.score === null ? "" : ` ${formatScore(e.score)}`}`).join(", ");
  return `${claim.text}: ${evidence}.`;
}

/** An empty structured memory, for a user with nothing said about them yet. */
export function emptyClaims(): MemoryClaims {
  return { sentence: "", claims: [], rejected: [] };
}
