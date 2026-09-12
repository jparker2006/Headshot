/**
 * The Log field's state machine (SPEC v5.3 → Log field). Four steps and
 * nothing else:
 *
 *   idle → picked → logged (with an undo for ten seconds) → idle
 *
 * `undo` from `logged` goes through `undone`, which says so for two seconds and
 * then falls back to idle. Pure, so `tests/client/logFieldState.test.ts` can
 * hold every transition to account without a renderer or a timer.
 */
import type { WatchedRating } from "@/lib/taste/types";
import { formatScore } from "./scoreRules";

/** How long the "logged X · undo" line stays up. */
export const UNDO_MS = 10_000;
/** How long "undone" stays up before the field goes quiet again. */
export const UNDONE_MS = 2_000;

export type LogFieldState =
  | { step: "idle" }
  /** A title is picked and the rating block is open. */
  | { step: "picked"; imdbId: string }
  /** It is written; the line under the field offers `undo`. */
  | { step: "logged"; imdbId: string; line: string }
  | { step: "undone" };

export type LogFieldEvent =
  | { type: "pick"; imdbId: string }
  | { type: "cancel" }
  | { type: "logged"; imdbId: string; line: string }
  | { type: "undo" }
  /** The undo window, or the "undone" line, ran out. */
  | { type: "expire" };

export const initialLogField: LogFieldState = { step: "idle" };

export function logFieldReducer(state: LogFieldState, event: LogFieldEvent): LogFieldState {
  switch (event.type) {
    case "pick":
      // Picking again from any step replaces whatever was there: the field is
      // the one thing on screen and the newest pick is what it is about.
      return { step: "picked", imdbId: event.imdbId };
    case "cancel":
      // Cancel backs out of a pick. It never clears a line that is already a
      // fact — a logged row is undone, not cancelled.
      return state.step === "picked" ? { step: "idle" } : state;
    case "logged":
      return { step: "logged", imdbId: event.imdbId, line: event.line };
    case "undo":
      return state.step === "logged" ? { step: "undone" } : state;
    case "expire":
      return state.step === "logged" || state.step === "undone" ? { step: "idle" } : state;
  }
}

/** How long the current step waits before it expires, or null when it does not. */
export function stepTimeout(state: LogFieldState): number | null {
  if (state.step === "logged") return UNDO_MS;
  if (state.step === "undone") return UNDONE_MS;
  return null;
}

/**
 * The line under the field: `logged Heat 9`, or the state word when nobody
 * put a number on it (`logged Heat want`). The `undo` link is drawn beside it,
 * not written into it.
 */
export function loggedLine(row: { rating: WatchedRating; score?: number | null }, name: string): string {
  const title = name.trim() || "that";
  if (row.rating === "rated" && row.score != null) return `logged ${title} ${formatScore(row.score)}`;
  return `logged ${title} ${row.rating === "unseen" ? "not seen" : row.rating}`;
}
