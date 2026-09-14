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
 * v5.3: the model no longer writes the prose. It returns JSON claims, each
 * with the imdb ids that prove it; `validateClaims` checks them against the
 * rows this rewrite actually read, and `renderClaimsMarkdown` renders the
 * markdown the agent reads. The model's words survive only inside a claim's
 * `text` and the one sentence at the top.
 *
 * This runs in the background (`waitUntil`). It must never throw and never
 * fail the request that scheduled it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { generateText, type LanguageModel } from "ai";
import type { IndustryGraph } from "@/lib/graph/engine";
import type { EpisodeKind, EpisodeRow, MemoryClaims, TasteStore, WatchedRow } from "@/lib/taste/types";
import { formatTasteContext, tasteSummary, type TasteSummary } from "@/lib/agent/tasteContext";
import { boldNames, hashRows, normalizeTitle, notesFromEpisodes, renderRows } from "./rows";
import { renderClaimsMarkdown, validateClaims, type EvidenceLookup } from "./claims";

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
  /** SPEC v5.3: the validated claims this rewrite produced. */
  claims: MemoryClaims;
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
    const people = peopleIds(summary);

    const pinned = (row?.pinned ?? "").trim();
    const previousClaims = row?.claims ?? null;
    const previous = stripPinned(row?.markdown ?? "", pinned);
    const { text } = await generateText({
      model,
      system: rewritePrompt(),
      prompt: buildPrompt({ previous, previousClaims, pinned, facts, people, rows: rendered, episodes: fresh }),
      maxOutputTokens: 900,
      // The rewrite model is a thinking model on some routes; the whole budget
      // would go to reasoning about forty lines. Off, like every cheap call.
      providerOptions: { openrouter: { reasoning: { enabled: false } } },
    });

    const raw = parseClaims(text);
    if (!raw) {
      log(`[memory] skip ${userId}: model returned no JSON`);
      return null;
    }
    // Nothing the model said is trusted: evidence must be rows this rewrite
    // actually read, and a rejected claim can never come back.
    const claims = validateClaims(raw, {
      knownIds: [...rendered.ids, ...people.map((p) => p.imdbId)],
      scores: new Map(watched.map((w) => [w.titleImdbId, w.rating === "rated" ? w.score : null])),
      previous: previousClaims,
    });
    if (!claims.sentence && claims.claims.length === 0) {
      log(`[memory] skip ${userId}: nothing survived validation`);
      return null;
    }

    const body = capLines(renderClaimsMarkdown(claims, lookupEvidence(graph, watched)), MAX_LINES);
    const markdown = pinned ? `${body}\n\n${PINNED_HEADING}\n${pinned}` : body;

    // What the log no longer holds: the titles the last memory named. With
    // claims stored, their evidence ids are exact and the bold-name scan of the
    // old prose is skipped — that prose is rendered from the same claims and
    // names people too, and a person's name can collide with a title's
    // ("Stan Lee" is also a documentary). The scan is only for a pre-v5.3 row.
    const dropped = previousClaims
      ? droppedFromClaims(graph, previousClaims, rendered.ids)
      : droppedTitles(graph, previous, rendered.names);
    // Anything the user has not seen yet stays on the list until they dismiss it.
    const carried = mergeDropped(row?.dropped ?? [], dropped);
    await store.setMemory(userId, { markdown, claims, dropped: carried, rowsHash });
    log(`[memory] rewrote ${userId}: ${claims.claims.length} claims from ${rendered.total} rows and ${fresh.length} new episodes${dropped.length ? `, dropped ${dropped.join(", ")}` : ""}`);
    return { markdown, claims, dropped };
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

/** The people the taste summary knows, with the ids the model may cite. */
function peopleIds(summary: TasteSummary | null): { imdbId: string; name: string }[] {
  const out: { imdbId: string; name: string }[] = [];
  for (const person of summary?.people ?? []) {
    if (person.imdbId) out.push({ imdbId: person.imdbId, name: person.name });
  }
  return out;
}

/**
 * Name and score for one evidence id: the row's score when the log has one,
 * the graph's name either way (a person id has no score).
 */
export function lookupEvidence(graph: Pick<IndustryGraph, "nodeByImdbId">, rows: WatchedRow[]): EvidenceLookup {
  const scores = new Map<string, number | null>();
  for (const row of rows) scores.set(row.titleImdbId, row.rating === "rated" ? row.score : null);
  return (imdbId) => {
    const node = graph.nodeByImdbId(imdbId);
    if (!node && !scores.has(imdbId)) return undefined;
    return { name: node?.name ?? imdbId, score: scores.get(imdbId) ?? null };
  };
}

/**
 * Titles the previous claims cited that the log no longer holds. Unlike the
 * bold-name check this needs no guessing: the evidence was an id.
 */
export function droppedFromClaims(
  graph: Pick<IndustryGraph, "nodeByImdbId">,
  previous: MemoryClaims | null | undefined,
  rowIds: string[],
): string[] {
  const inRows = new Set(rowIds);
  const out: string[] = [];
  for (const claim of previous?.claims ?? []) {
    for (const id of claim.evidence) {
      // People are not in the log and never "fall out" of it.
      if (!id.startsWith("tt") || inRows.has(id)) continue;
      const name = graph.nodeByImdbId(id)?.name;
      if (name) out.push(name);
    }
  }
  return out;
}

/**
 * Pull the JSON object out of whatever the model said: a bare object, a fenced
 * block, or an object with a line of chatter around it. Null when there is
 * none, or when it does not parse — the caller then leaves the memory alone.
 */
export function parseClaims(text: string): { sentence?: unknown; claims?: unknown } | null {
  const candidates: string[] = [];
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*\n([\s\S]*?)\n?```/i.exec(trimmed);
  if (fenced) candidates.push(fenced[1].trim());
  candidates.push(trimmed);
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as { sentence?: unknown; claims?: unknown };
    } catch {
      // Try the next shape.
    }
  }
  return null;
}

function buildPrompt(input: {
  previous: string;
  previousClaims: MemoryClaims | null;
  pinned: string;
  facts: string;
  people: { imdbId: string; name: string }[];
  rows: { text: string; total: number };
  episodes: EpisodeRow[];
}): string {
  const shown = input.rows.text ? input.rows.text.split("\n").length : 0;
  const more = input.rows.total > shown ? ` (the ${shown} most recently touched of ${input.rows.total})` : "";
  const claims = input.previousClaims?.claims ?? [];
  const rejected = input.previousClaims?.rejected ?? [];
  const parts = [
    input.rows.text
      ? `Their log as it stands right now${more}, one row per line, imdb id first. This is the truth: every evidence id must be one of these.\n${input.rows.text}`
      : "Their log is empty right now. Do not name a title as something they have watched.",
    input.facts ? `Derived from the same log (facts, not prose):\n${input.facts}` : "",
    input.people.length ? `People the log knows, with the ids you may cite as evidence:\n${input.people.map((p) => `- ${p.imdbId} · ${p.name}`).join("\n")}` : "",
    claims.length
      ? `The claims you made last time. Keep the ones the log still supports, word for word.\n${claims.map((c) => `- [${c.polarity}] ${c.text} — ${c.evidence.join(", ")}`).join("\n")}`
      : input.previous
        ? `The memory you wrote last time, before claims existed. Turn what the log still supports into claims.\n${input.previous}`
        : "There is no memory yet; write the first one.",
    rejected.length
      ? `Claims this person has rejected. Never restate any of these, in any wording — a synonym is the same claim.\n${rejected.map((r) => `- ${r.text}`).join("\n")}`
      : "",
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

export function capLines(text: string, max: number): string {
  const lines = text.split("\n");
  if (lines.length <= max) return text.trim();
  return lines.slice(0, max).join("\n").trim();
}
