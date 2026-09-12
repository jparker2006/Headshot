/**
 * The log as the memory rewrite reads it (SPEC v5.2): one line per watched
 * row, newest first, with the note the user typed attached.
 *
 * Rows are the truth. The prose is rebuilt from this rendering every time, so
 * a deleted row disappears from the memory on the next rewrite and a re-rated
 * row carries its new score into the prompt.
 */
import type { EpisodeRow, WatchedRow } from "@/lib/taste/types";

/** How many rows one rendering carries, before the note rows are added back. */
export const MAX_ROWS = 200;

/** What a row without a score reads as. */
const STATE: Record<string, string> = { want: "want to watch", seen: "seen, no opinion", unseen: "never seen" };

export interface RowsGraph {
  nodeByImdbId(imdbId: string): { name: string; year: number; titleType?: string } | undefined;
}

/**
 * The note a title carries: the last thing the user said about it, quoted at
 * the end of its `log` or `chat` episode ("rated Heat (1995) 8/10: "…"").
 *
 * Newest first, and the first *quoted* line wins: logging a title again
 * without a note keeps the note it already had (SPEC v5.2).
 */
export function notesFromEpisodes(rows: EpisodeRow[]): Map<string, string> {
  const notes = new Map<string, string>();
  for (const episode of rows) {
    if (!episode.titleImdbId || notes.has(episode.titleImdbId)) continue;
    if (episode.kind !== "log" && episode.kind !== "chat") continue;
    const quoted = /: "([^]+)"$/.exec(episode.text);
    if (quoted) notes.set(episode.titleImdbId, quoted[1]);
  }
  return notes;
}

/** film | show, from the graph's title type. */
function kindOf(titleType: string | undefined): "film" | "show" {
  return titleType === "tvSeries" || titleType === "tvMiniSeries" ? "show" : "film";
}

export interface RenderedRows {
  /** One line per row, newest updated first. */
  text: string;
  /** Every title name in the rendering, for the drop check. */
  names: string[];
  /**
   * SPEC v5.3: every row's imdb id, in the same order as `names`. Claim
   * evidence must be one of these (or a person id the summary knows).
   */
  ids: string[];
  /** How many rows the user has in total, including the ones not rendered. */
  total: number;
}

/**
 * Render the rows for the prompt: newest updated first, capped at `MAX_ROWS`
 * plus every row carrying a note (a remark is the rarest and most valuable
 * thing in the log, so it is never cut).
 */
export function renderRows(rows: WatchedRow[], graph: RowsGraph, notes: Map<string, string>): RenderedRows {
  const sorted = [...rows].sort((a, b) => (a.updatedAt === b.updatedAt ? (a.titleImdbId < b.titleImdbId ? -1 : 1) : a.updatedAt < b.updatedAt ? 1 : -1));
  const kept = sorted.slice(0, MAX_ROWS);
  const keptIds = new Set(kept.map((r) => r.titleImdbId));
  for (const row of sorted.slice(MAX_ROWS)) {
    if (notes.has(row.titleImdbId) && !keptIds.has(row.titleImdbId)) {
      kept.push(row);
      keptIds.add(row.titleImdbId);
    }
  }

  const names: string[] = [];
  const ids: string[] = [];
  const lines = kept.map((row) => {
    const node = graph.nodeByImdbId(row.titleImdbId);
    const name = node?.name ?? row.titleImdbId;
    names.push(name);
    ids.push(row.titleImdbId);
    const year = node?.year ? ` (${node.year})` : "";
    const parts = [
      // v5.3: the id first, so the model can cite a row as evidence.
      row.titleImdbId,
      `${name}${year}`,
      kindOf(node?.titleType),
      row.rating === "rated" && row.score != null ? `${row.score}/10` : (STATE[row.rating] ?? row.rating),
    ];
    if (row.season != null) parts.push(`season ${row.season}`);
    const note = notes.get(row.titleImdbId);
    if (note) parts.push(`"${note}"`);
    parts.push(row.source);
    parts.push((row.watchedAt ?? row.updatedAt).slice(0, 10));
    return `- ${parts.join(" · ")}`;
  });

  return { text: lines.join("\n"), names, ids, total: rows.length };
}

/** A cheap, stable hash of one rendering: unchanged rows must be a no-op. */
export function hashRows(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}-${text.length.toString(36)}`;
}

/** Title and person names the same way, so "The Wire" matches "the wire". */
export function normalizeTitle(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Every `**name**` token in a markdown body, in order, deduped. */
export function boldNames(markdown: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of markdown.matchAll(/\*\*([^*\n]{1,80})\*\*/g)) {
    const name = m[1].trim();
    const key = normalizeTitle(name);
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
