/**
 * "Cursor for movies": every entity name in an answer is a link. This is the
 * pure half: build an index of names → ids from the data parts a message
 * already carries (nodes, candidates, paths) and resolve emphasized text
 * against it. Unmatched names fall back to the search route on click.
 */
import type { HeadshotUIMessage } from "@/lib/agent/events";

export interface EntityRef {
  imdbId: string;
  name: string;
  kind: "person" | "title";
}

export type EntityIndex = Map<string, EntityRef>;

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

function add(index: EntityIndex, ref: EntityRef) {
  const key = norm(ref.name);
  if (!key) return;
  // First writer wins: nodes on the chosen path arrive first and are the intended referents.
  if (!index.has(key)) index.set(key, ref);
}

/** Names → ids for one message, from the parts it already received. */
export function entityIndex(parts: HeadshotUIMessage["parts"]): EntityIndex {
  const index: EntityIndex = new Map();
  const kindOf = (id: string): "person" | "title" => (id.startsWith("nm") ? "person" : "title");
  for (const p of parts) {
    if (p.type === "data-chosen") {
      p.data.path.imdbIds.forEach((id, i) => add(index, { imdbId: id, name: p.data.path.names[i], kind: kindOf(id) }));
    }
  }
  for (const p of parts) {
    if (p.type === "data-node") add(index, { imdbId: p.data.imdbId, name: p.data.name, kind: p.data.kind });
    else if (p.type === "data-paths") {
      for (const set of [p.data.strong, p.data.full]) for (const path of set?.paths ?? []) path.imdbIds.forEach((id, i) => add(index, { imdbId: id, name: path.names[i], kind: kindOf(id) }));
    } else if (p.type === "data-candidates") {
      for (const c of p.data.candidates) add(index, { imdbId: c.imdbId, name: c.name, kind: c.kind });
    }
  }
  return index;
}

/** Build an index from plain refs (pages, face grids). */
export function makeIndex(refs: EntityRef[]): EntityIndex {
  const index: EntityIndex = new Map();
  for (const r of refs) add(index, r);
  return index;
}

/** Index across a whole thread: later messages can mention people from earlier ones. */
export function threadIndex(messages: HeadshotUIMessage[]): EntityIndex {
  const index: EntityIndex = new Map();
  for (const m of messages) for (const [k, v] of entityIndex(m.parts)) if (!index.has(k)) index.set(k, v);
  return index;
}

/**
 * Resolve emphasized text to an entity. Tries the exact name, then the name
 * with a trailing year or parenthetical removed ("Apollo 13 (1995)"), then a
 * possessive ("Bacon's").
 */
export function resolveEntity(index: EntityIndex, text: string): EntityRef | null {
  const raw = norm(text);
  if (!raw) return null;
  const candidates = [raw, raw.replace(/\s*\(\d{4}\)$/, ""), raw.replace(/\s+\d{4}$/, ""), raw.replace(/'s$/, "")];
  for (const c of candidates) {
    const hit = index.get(c);
    if (hit) return hit;
  }
  return null;
}

/** Whether emphasized text looks like a name worth a search fallback (not "two degrees" or "1995"). */
export function looksLikeName(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 60) return false;
  if (/^\d+$/.test(t)) return false;
  // At least one capitalized word or a digit-led title ("12 Angry Men").
  return /(^|\s)[A-ZÀ-Ý0-9]/.test(t);
}
