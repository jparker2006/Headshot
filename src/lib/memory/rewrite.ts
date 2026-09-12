/**
 * The beliefs layer (SPEC v4, rebuilt in v5.2): a ≤40-line markdown memory of
 * one person's taste, rewritten by a cheap model after anything that changed
 * the log.
 *
 * v5.2: the prose is rebuilt from the *rows* first. The primary input is a
 * compact rendering of the current watched rows (newest first, capped, every
 * row with a note kept); the secondary input is the chat and swipe episodes
 * written since the last rewrite — logging episodes are redundant with the
 * rows and are dropped. A title that is no longer in the rows must not survive
 * in the prose, and the titles that did not survive come back as `dropped`.
 *
 * This runs in the background (`waitUntil`). It must never throw and never
 * fail the request that scheduled it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { generateText, type LanguageModel } from "ai";
import type { IndustryGraph } from "@/lib/graph/engine";
import type { EpisodeKind, EpisodeRow, TasteStore } from "@/lib/taste/types";
import { formatTasteContext, tasteSummary } from "@/lib/agent/tasteContext";
import { boldNames, hashRows, normalizeTitle, notesFromEpisodes, renderRows } from "./rows";

const PROMPT_PATH = path.join(process.cwd(), "src", "lib", "memory", "rewrite.md");

let prompt: string | undefined;
function rewritePrompt(): string {
  return (prompt ??= readFileSync(PROMPT_PATH, "utf8").replace(/^# [^\n]*\n+/, "").trim());
}

/** The heading the user's own pinned lines live under, inside the markdown. */
export const PINNED_HEADING = "## In your words";

/** Hard cap from the spec: the memory is a page, not a transcript. */
export const MAX_LINES = 40;

/** Newest-first evidence cap for one rewrite. */
export const MAX_EPISODES = 60;

/**
 * The episode kinds that are still evidence once the rows are the truth:
 * things they said in chat and swipe sessions. A `log` episode only restates a
 * row the prompt already carries.
 */
export const EVIDENCE_KINDS: EpisodeKind[] = ["chat", "swipe"];

/** How many episodes are scanned for the note attached to a title. */
const NOTE_SCAN = 500;

export interface RewriteDeps {
  store: TasteStore;
  graph: IndustryGraph;
  model: LanguageModel;
  /** Unused since v5.2 (the rows hash is the guard); kept for callers. */
  now?: () => Date;
  log?: (message: string) => void;
}

export interface RewriteResult {
  markdown: string;
  /**
   * Titles the old prose named that the log no longer holds. Deterministic:
   * the bold names in the previous markdown, minus the row titles.
   */
  dropped: string[];
}

/**
 * Rewrite this user's memory. Returns the new markdown and what it dropped, or
 * null when the rewrite was skipped (nothing changed) or failed.
 *
 * Skipped means the rows render exactly as they did for the last rewrite and
 * no chat or swipe episode has been written since: there is nothing to say.
 */
export async function rewriteMemory(deps: RewriteDeps, userId: string): Promise<RewriteResult | null> {
  const { store, graph, model } = deps;
  const log = deps.log ?? (() => {});
  try {
    const row = await store.getMemory(userId);
    const since = row?.updatedAt;
    // `since` is inclusive on purpose: an episode written in the same
    // millisecond as the row counts as new. Rewriting once too often is
    // cheaper than dropping the evidence of a fast second log.
    const [watched, recent, all] = await Promise.all([
      store.listWatched(userId),
      store.listEpisodes(userId, { limit: MAX_EPISODES, since }),
      store.listEpisodes(userId, { limit: NOTE_SCAN }),
    ]);
    const fresh = recent.filter((e) => EVIDENCE_KINDS.includes(e.kind));

    const notes = notesFromEpisodes(all);
    const rendered = renderRows(watched, graph, notes);
    const rowsHash = hashRows(rendered.text);

    // The v5.2 no-op, and the only guard there is now: the rows the last
    // rewrite saw, and nothing said since. It stands in for the old 20-second
    // window — a double-fire recomputes the same rendering and stops here —
    // and it is exact where a clock was a guess: a log five seconds after the
    // last rewrite changes the rows, so it is never swallowed.
    if (row && fresh.length === 0 && row.rowsHash && row.rowsHash === rowsHash) {
      log(`[memory] skip ${userId}: rows unchanged and no new evidence`);
      return null;
    }

    if (!watched.length && fresh.length === 0) {
      log(`[memory] skip ${userId}: nothing to write about yet`);
      return null;
    }

    const summary = await tasteSummary(graph, store, userId);
    const facts = summary ? formatTasteContext(summary) : "";

    const pinned = (row?.pinned ?? "").trim();
    const previous = stripPinned(row?.markdown ?? "", pinned);
    const { text } = await generateText({
      model,
      system: rewritePrompt(),
      prompt: buildPrompt({ previous, pinned, facts, rows: rendered, episodes: fresh }),
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

    const dropped = droppedTitles(graph, previous, rendered.names);
    const stillThere = dropped.filter((name) => boldNames(body).some((n) => normalizeTitle(n) === normalizeTitle(name)));
    if (stillThere.length) {
      // The prompt says a title not in the rows must not appear. When one does
      // anyway we do not edit the model's prose — we say so, and it is still
      // reported as dropped, because the log is what the user can act on.
      log(`[memory] warn ${userId}: not in the log but still in the prose: ${stillThere.join(", ")}`);
    }
    // Anything the user has not seen yet stays on the list until they dismiss it.
    const carried = mergeDropped(row?.dropped ?? [], dropped);
    await store.setMemory(userId, { markdown, dropped: carried, rowsHash });
    log(`[memory] rewrote ${userId}: ${body.split("\n").length} lines from ${rendered.total} rows and ${fresh.length} new episodes${dropped.length ? `, dropped ${dropped.join(", ")}` : ""}`);
    return { markdown, dropped };
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

/**
 * Titles the previous prose named that the rows no longer hold. Deterministic
 * string matching, never the model: every `**bold**` token in the old body
 * that the graph knows as a title and the rendering does not name.
 */
export function droppedTitles(graph: { searchByName: IndustryGraph["searchByName"] }, previous: string, rowNames: string[]): string[] {
  const inRows = new Set(rowNames.map(normalizeTitle));
  const out: string[] = [];
  for (const name of boldNames(previous)) {
    const key = normalizeTitle(name);
    if (inRows.has(key)) continue;
    if (!isTitle(graph, name)) continue;
    out.push(name);
  }
  return out;
}

/** A bold token is a title when the graph knows a title by exactly that name. */
function isTitle(graph: { searchByName: IndustryGraph["searchByName"] }, name: string): boolean {
  try {
    const key = normalizeTitle(name);
    return graph.searchByName(name, 6, "title").some((n) => normalizeTitle(n.name) === key);
  } catch {
    return false;
  }
}

/** Previous, undismissed drops plus this rewrite's, deduped, newest last. */
function mergeDropped(previous: string[], next: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of [...previous, ...next]) {
    const key = normalizeTitle(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.slice(-12);
}

function buildPrompt(input: {
  previous: string;
  pinned: string;
  facts: string;
  rows: { text: string; total: number };
  episodes: EpisodeRow[];
}): string {
  const shown = input.rows.text ? input.rows.text.split("\n").length : 0;
  const more = input.rows.total > shown ? ` (the ${shown} most recently touched of ${input.rows.total})` : "";
  const parts = [
    input.rows.text
      ? `Their log as it stands right now${more}. This is the truth: every title in the memory must be one of these, with the score it has here.\n${input.rows.text}`
      : "Their log is empty right now. Do not name a title as something they have watched.",
    input.facts ? `Derived from the same log (facts, not prose):\n${input.facts}` : "",
    input.previous ? `The memory you wrote last time. Keep what the log still supports, and drop the rest.\n${input.previous}` : "There is no memory yet; write the first one.",
    input.pinned
      ? `Lines this person pinned themselves. They are theirs, not yours: never rewrite or repeat them, but let them steer what you keep.\n${input.pinned}`
      : "",
    input.episodes.length
      ? `What they have said and swiped since the last rewrite, newest first:\n${input.episodes.map((e) => `- ${e.at.slice(0, 10)} [${e.kind}] ${e.text}`).join("\n")}`
      : "Nothing new said since the last rewrite; rebuild from the log and tighten what you have.",
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
