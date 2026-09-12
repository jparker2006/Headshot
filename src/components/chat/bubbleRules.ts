/**
 * How an assistant turn becomes bubbles (SPEC v5.1 -> "Stored answers"). Pure,
 * so `tests/client/composer.test.ts` can hold the collapsing rules without React.
 */
/**
 * Everything the agent said in one string (SPEC v5.1 → "Stored answers"):
 * whitespace-only parts dropped, the rest joined with one blank line so two
 * separate parts read as two paragraphs and never as two bubbles.
 */
export function mergedText(parts: readonly { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string" && p.text.trim().length > 0)
    .map((p) => (p.text ?? "").trim())
    .join("\n\n");
}

/** The index of the one tool step worth naming: the last one still running. */
export function liveToolIndex(parts: readonly { type: string; state?: unknown; text?: string }[]): number {
  let at = -1;
  parts.forEach((p, i) => {
    if (!p.type.startsWith("tool-")) return;
    const state = "state" in p ? String(p.state) : "";
    if (!state.startsWith("output")) at = i;
  });
  return at;
}

