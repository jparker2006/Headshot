/**
 * The memory diff a swipe session shows before it hands you back to You
 * (SPEC v4, "swipe as lore"): what the rewrite added and what it dropped.
 *
 * Line-wise and order-insensitive on purpose. The rewrite model reorders the
 * page freely, so a positional diff would report the whole memory as changed
 * every time; what the reader wants is "it now knows this, it stopped saying
 * that". Headings are structure, not belief, so they never show up, and the
 * pinned block is the user's own words — the rewrite cannot touch it, so it is
 * cut from both sides before comparing.
 */
import { PINNED_HEADING } from "@/lib/memory";

export interface MemoryDiff {
  added: string[];
  removed: string[];
}

/** Compare two memory markdowns. Both directions of the set difference. */
export function diffLines(before: string, after: string): MemoryDiff {
  const a = beliefLines(before);
  const b = beliefLines(after);
  return {
    added: [...b].filter(([key]) => !a.has(key)).map(([, line]) => line),
    removed: [...a].filter(([key]) => !b.has(key)).map(([, line]) => line),
  };
}

/**
 * The comparable lines of one memory: normalised key → the line as written.
 * Whitespace-insensitive (the model re-wraps), first occurrence wins.
 */
function beliefLines(markdown: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of stripPinned(markdown).split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const key = line.replace(/\s+/g, " ").toLowerCase();
    if (!out.has(key)) out.set(key, line);
  }
  return out;
}

/** Everything from the pinned heading down is the user's, not the model's. */
function stripPinned(markdown: string): string {
  const at = markdown.indexOf(PINNED_HEADING);
  return at >= 0 ? markdown.slice(0, at) : markdown;
}
