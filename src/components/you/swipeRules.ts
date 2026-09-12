/**
 * The rules the swipe session and the deck-first onboarding run on, kept out
 * of the components so `tests/client/swipeRules.test.ts` can hold them to
 * account without a renderer — the same seam as `recent.ts` and
 * `numbersRules.ts`.
 *
 * Nothing here talks to the network. The session route
 * (`POST /api/taste/swipe/session`) owns the writes, the one episode and the
 * memory rewrite; this file only decides what the screen says.
 */

/** How the deck was built: from your liked people's neighbours, or cold. */
export type DeckMode = "lore" | "cold";

/**
 * A session may be ended by hand only once it has said something. Ten cards
 * is the floor the brief fixes; the deck itself is thirty.
 */
export const SESSION_MIN = 10;

/** Thirty per session (SPEC v4 → Swipe as lore). */
export const SESSION_SIZE = 30;

export function canFinish(rated: number): boolean {
  return rated >= SESSION_MIN;
}

/**
 * The end control's label: the invitation once the session is worth a rewrite,
 * and the cost of stopping before that. Copy rule — one line, lowercase, and
 * it tells you what it costs.
 */
export function finishLabel(rated: number): string {
  if (canFinish(rated)) return "done for now";
  const left = SESSION_MIN - rated;
  return `${left} more and I'll rewrite your profile`;
}

/** One line under the heading saying where these thirty came from. */
export function deckBlurb(mode: DeckMode): string {
  return mode === "lore"
    ? "unrated things the people you like keep turning up in"
    : "the well-known ones, because I have nothing on you yet";
}

/** The mono progress figure, top-right of the column: `12 / 30`. */
export function progressLabel(rated: number, total: number): string {
  if (total <= 0) return "0 / 0";
  return `${Math.min(rated + 1, total)} / ${total}`;
}

// ---- the deck card --------------------------------------------------------

/** What the deck route sends. Poster fields are optional; the client fills in. */
export interface DeckCardPayload {
  imdbId: string;
  name: string;
  year?: number | null;
  kind?: string | null;
  /** The pre-v4 field name for the same fact. */
  titleType?: string | null;
  posterUrl?: string | null;
  posterPath?: string | null;
  runtime?: number | null;
}

/** `film` / `show` — the words board C uses, never `movie` / `series`. */
export function deckKindWord(card: Pick<DeckCardPayload, "kind" | "titleType">): "film" | "show" {
  const raw = (card.kind ?? card.titleType ?? "").toLowerCase();
  return raw === "movie" || raw === "film" ? "film" : "show";
}

/**
 * The one mono line under the title: `1984 · film · 107m`. Terminal grammar —
 * lowercase, `·` between, and a fact is dropped rather than faked.
 */
export function deckCardMeta(card: DeckCardPayload): string {
  return [card.year ? String(card.year) : null, deckKindWord(card), card.runtime ? `${card.runtime}m` : null]
    .filter(Boolean)
    .join(" · ");
}

// ---- the memory diff -----------------------------------------------------

export interface MemoryDiffLines {
  added: string[];
  removed: string[];
}

/**
 * The mono count beside `what changed`: `+3 −1`, a single side when only one
 * moved, and `no change` when the rewrite said the same thing twice. The minus
 * is U+2212, not a hyphen — it is a figure, not punctuation.
 */
export function diffCount(diff: MemoryDiffLines): string {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`+${diff.added.length}`);
  if (diff.removed.length) parts.push(`−${diff.removed.length}`);
  return parts.length > 0 ? parts.join(" ") : "no change";
}

/**
 * A memory line as the diff shows it: markdown markers and bold stars gone,
 * because the diff is a change log, not prose. The profile below it is where
 * the markdown is rendered properly.
 */
export function diffLineText(raw: string): string {
  return raw
    .replace(/^#+\s*/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/\*\*/g, "")
    .trim();
}

/** Drop the lines that are only markdown scaffolding once stripped. */
export function diffLines(lines: readonly string[]): string[] {
  return lines.map(diffLineText).filter((l) => l.length > 0);
}

// ---- deck-first onboarding ------------------------------------------------

export type OnboardingStep = "swipe" | "services" | "imports";

/** Fixed order (SPEC v4 → Surfaces): the deck first, then what you pay for, then the CSVs. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = ["swipe", "services", "imports"] as const;

/**
 * A new account is one whose log is empty. `null` is "not known yet" and is
 * deliberately not new — a half-loaded You page must never flash the deck at
 * somebody with a hundred titles.
 */
export function isNewAccount(watched: readonly unknown[] | null | undefined): boolean {
  return Array.isArray(watched) && watched.length === 0;
}

/** The mono step index. No progress bar, no wizard chrome. */
export function stepLabel(step: OnboardingStep): string {
  const i = ONBOARDING_STEPS.indexOf(step);
  return `${(i < 0 ? 0 : i) + 1} / ${ONBOARDING_STEPS.length}`;
}

/** The next step, or null when the flow is over and You takes the page. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.indexOf(step);
  return i < 0 ? null : (ONBOARDING_STEPS[i + 1] ?? null);
}
