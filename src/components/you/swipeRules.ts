/**
 * The rules the catch-up deck runs on, kept out of the components so
 * `tests/client/swipeRules.test.ts` can hold them to account without a
 * renderer — the same seam as `recent.ts` and `numbersRules.ts`.
 *
 * Nothing here talks to the network. The session route
 * (`POST /api/taste/swipe/session`) owns the writes, the one episode and the
 * memory rewrite; this file only decides what the screen says.
 */
import type { SwipeAction } from "@/lib/picks/swipe";

/** How the deck was built: from your liked people's neighbours, or cold. */
export type DeckMode = "lore" | "cold";

/**
 * Ten per round (SPEC v5 → Catch-up deck). There is no minimum: a round is
 * these ten, or "done for now" at any point — whatever was committed is what
 * gets written and rewritten, and nothing committed just goes back to the log.
 */
export const SESSION_SIZE = 10;

/**
 * The card's first step. Two words, because the only question a catch-up card
 * asks is whether you have seen it; the score is the second step and only
 * exists for the answer that has one.
 */
export const VERDICTS = [
  { id: "seen", label: "seen it", key: "s" },
  { id: "unseen", label: "not seen", key: "n" },
] as const;

export type VerdictId = (typeof VERDICTS)[number]["id"];

/** Undo, one key, everywhere in the deck. */
export const UNDO_KEY = "z";

/** What "not seen" writes: a state, never a score. */
export const UNSEEN_ACTION: SwipeAction = { rating: "unseen" };

/** What a tapped number writes: the state plus the score you picked. */
export function scoreAction(score: number): SwipeAction {
  return { rating: "rated", score };
}

/** The end control, always available — there is no card you must reach. */
export function doneLabel(): string {
  return "done for now";
}

/** One line saying where these ten came from. */
export function deckBlurb(mode: DeckMode): string {
  return mode === "lore"
    ? "things I think you have probably seen, going by who you like"
    : "the well-known ones, because I have nothing on you yet";
}

/** The mono progress figure, top-right of the column: `3 / 10`. */
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
