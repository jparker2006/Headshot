/**
 * The beliefs layer (SPEC v4): a ≤40-line markdown memory of one person's
 * taste, rewritten by a cheap model after anything that added evidence.
 *
 * Inputs: the memory as it stands, the facts summary the chat already uses,
 * and the episodes written since the memory was last touched. Output: new
 * markdown, with the user's own pinned lines re-attached verbatim — the model
 * sees the pinned block as context but never gets to edit it.
 *
 * This runs in the background (`waitUntil`). It must never throw and never
 * fail the request that scheduled it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { generateText, type LanguageModel } from "ai";
import type { IndustryGraph } from "@/lib/graph/engine";
import type { EpisodeRow, TasteStore } from "@/lib/taste/types";
import { formatTasteContext, tasteSummary } from "@/lib/agent/tasteContext";

const PROMPT_PATH = path.join(process.cwd(), "src", "lib", "memory", "rewrite.md");

let prompt: string | undefined;
function rewritePrompt(): string {
  return (prompt ??= readFileSync(PROMPT_PATH, "utf8").replace(/^# [^\n]*\n+/, "").trim());
}

/** The heading the user's own pinned lines live under, inside the markdown. */
export const PINNED_HEADING = "## In your words";

/** Hard cap from the spec: the memory is a page, not a transcript. */
export const MAX_LINES = 40;

/** How long after a write another rewrite is considered a duplicate run. */
export const GUARD_MS = 20_000;

/** Newest-first evidence cap for one rewrite. */
export const MAX_EPISODES = 60;

export interface RewriteDeps {
  store: TasteStore;
  graph: IndustryGraph;
  model: LanguageModel;
  now?: () => Date;
  log?: (message: string) => void;
}

/**
 * Rewrite this user's memory. Returns the new markdown, or null when the
 * rewrite was skipped (nothing new, a concurrent run) or failed.
 *
 * Concurrency guard, deliberately simple: if the memory row was written in the
 * last 20 seconds and no episode is newer than it, another rewrite has just
 * done this work, so we do nothing. A user who logs twice in five seconds
 * still gets a second rewrite, because the second log's episode is newer than
 * the row the first rewrite wrote.
 */
export async function rewriteMemory(deps: RewriteDeps, userId: string): Promise<string | null> {
  const { store, graph, model } = deps;
  const log = deps.log ?? (() => {});
  const now = deps.now ?? (() => new Date());
  try {
    const row = await store.getMemory(userId);
    const since = row?.updatedAt;
    // `since` is inclusive on purpose: an episode written in the same
    // millisecond as the row counts as new. Rewriting once too often is
    // cheaper than dropping the evidence of a fast second log.
    const episodes = await store.listEpisodes(userId, { limit: MAX_EPISODES, since });
    const fresh = episodes;

    if (row) {
      const age = now().getTime() - Date.parse(row.updatedAt);
      if (age >= 0 && age < GUARD_MS && fresh.length === 0) {
        log(`[memory] skip ${userId}: rewritten ${age}ms ago with no new evidence`);
        return null;
      }
      if (fresh.length === 0) {
        log(`[memory] skip ${userId}: no new evidence`);
        return null;
      }
    }

    const summary = await tasteSummary(graph, store, userId);
    const facts = summary ? formatTasteContext(summary) : "";
    if (!facts && fresh.length === 0) {
      log(`[memory] skip ${userId}: nothing to write about yet`);
      return null;
    }

    const pinned = (row?.pinned ?? "").trim();
    const previous = stripPinned(row?.markdown ?? "", pinned);
    const { text } = await generateText({
      model,
      system: rewritePrompt(),
      prompt: buildPrompt({ previous, pinned, facts, episodes: fresh.length ? fresh : episodes }),
      maxOutputTokens: 900,
      // The rewrite model is a thinking model on some routes; the whole budget
      // would go to reasoning about forty lines. Off, like every cheap call.
      providerOptions: { openrouter: { reasoning: { enabled: false } } },
    });

    const body = capLines(stripFence(text), MAX_LINES);
    if (!body) {
      log(`[memory] skip ${userId}: model returned nothing`);
      return null;
    }
    const markdown = pinned ? `${body}\n\n${PINNED_HEADING}\n${pinned}` : body;
    await store.setMemory(userId, { markdown });
    log(`[memory] rewrote ${userId}: ${body.split("\n").length} lines from ${fresh.length} new episodes`);
    return markdown;
  } catch (err) {
    log(`[memory] rewrite failed for ${userId}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * The memory as the chat should see it: the model's markdown, with the pinned
 * block appended when the stored markdown does not already carry it (a memory
 * the user pinned to before the first rewrite). Empty string when there is none.
 */
export async function memoryText(store: TasteStore, userId: string): Promise<string> {
  const row = await store.getMemory(userId);
  if (!row) return "";
  const markdown = row.markdown.trim();
  const pinned = row.pinned.trim();
  if (!pinned) return markdown;
  if (markdown.includes(pinned)) return markdown;
  return [markdown, `${PINNED_HEADING}\n${pinned}`].filter(Boolean).join("\n\n");
}

function buildPrompt(input: { previous: string; pinned: string; facts: string; episodes: EpisodeRow[] }): string {
  const parts = [
    input.previous ? `The memory you wrote last time:\n${input.previous}` : "There is no memory yet; write the first one.",
    input.pinned
      ? `Lines this person pinned themselves. They are theirs, not yours: never rewrite or repeat them, but let them steer what you keep.\n${input.pinned}`
      : "",
    input.facts ? `What their log says (facts, not prose):\n${input.facts}` : "",
    input.episodes.length
      ? `New evidence since then, newest first:\n${input.episodes.map((e) => `- ${e.at.slice(0, 10)} [${e.kind}] ${e.text}`).join("\n")}`
      : "No new evidence; tighten what you have.",
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** Drop a trailing pinned block so it is never fed back as text to rewrite. */
function stripPinned(markdown: string, pinned: string): string {
  const at = markdown.indexOf(PINNED_HEADING);
  if (at >= 0) return markdown.slice(0, at).trim();
  return pinned ? markdown.replace(pinned, "").trim() : markdown.trim();
}

function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```[a-z]*\n([\s\S]*?)\n?```$/i.exec(trimmed);
  return (fenced ? fenced[1] : trimmed).trim();
}

export function capLines(text: string, max: number): string {
  const lines = text.split("\n");
  if (lines.length <= max) return text.trim();
  return lines.slice(0, max).join("\n").trim();
}
