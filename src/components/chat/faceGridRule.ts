/**
 * Face grid decision rule (pure, unit-tested). A `mode: "answer"` grid is the
 * answer itself — one person — so a tap always opens their page. In `choose`
 * mode: if the model wrote nothing after the grid, identifying was the whole
 * question and a tap opens the person's page; otherwise a tap posts
 * "I mean <name>" so the agent continues.
 */
import type { HeadshotUIMessage } from "@/lib/agent/events";

export type FaceTap = "open" | "ask";

export function faceTapAction(parts: HeadshotUIMessage["parts"], gridIndex: number): FaceTap {
  const grid = parts[gridIndex];
  if (grid?.type === "data-faces" && grid.data.mode === "answer") return "open";
  for (let i = gridIndex + 1; i < parts.length; i++) {
    const p = parts[i];
    if (p.type === "text" && p.text.trim().length > 0) return "ask";
    if (p.type === "data-faces") break; // a later grid owns the rest
  }
  return "open";
}

export function meanText(name: string): string {
  return `I mean ${name}`;
}
