/**
 * The composer's rules, pure (SPEC v5.1 → "Composer (`.composer-lg`)").
 *
 * Kept out of `ChatPanel` so `tests/client/composer.test.ts` can hold the key
 * map, the growth cap and the send control's three states without React: the
 * panel only wires these to a textarea.
 */

/** The growth cap: six lines on a laptop, four on a phone (the tab bar is under it). */
export const MAX_ROWS = 6;
export const MAX_ROWS_PHONE = 4;

/** The subset of a keydown these rules need. `isComposing` is the IME guard. */
export interface ComposerKey {
  key: string;
  shiftKey?: boolean;
  isComposing?: boolean;
  /** Some browsers report an in-flight IME as keyCode 229 rather than `isComposing`. */
  keyCode?: number;
}

/**
 * What a keystroke in the composer does.
 *
 * Enter sends and Shift+Enter breaks a line — except while an IME is composing,
 * where Enter is the user accepting a candidate and must reach the field
 * untouched (`"none"`: no send, no `preventDefault`).
 */
export function keyAction(e: ComposerKey): "send" | "newline" | "none" {
  if (e.key !== "Enter") return "none";
  if (e.isComposing || e.keyCode === 229) return "none";
  return e.shiftKey ? "newline" : "send";
}

/**
 * How many rows the textarea should claim for this text: one per newline, plus
 * one, capped. Past the cap it scrolls inside itself. Wrapping is the browser's
 * business, so a long single line still counts as one row — the element's own
 * `scrollHeight` is what the panel then trusts for the fine adjustment.
 */
export function rowsFor(text: string, max: number = MAX_ROWS): number {
  const lines = text.length === 0 ? 1 : text.split("\n").length;
  return Math.max(1, Math.min(max, lines));
}

/**
 * The 32px control at the right end: nothing to send, an arrow to send it, or
 * a stop square while the turn is running.
 */
export function sendState(s: { text: string; busy: boolean }): "stop" | "send" | "disabled" {
  if (s.busy) return "stop";
  return s.text.trim().length > 0 ? "send" : "disabled";
}
