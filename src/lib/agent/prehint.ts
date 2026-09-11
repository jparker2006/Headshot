/**
 * Pre-resolution: pull likely entity names out of the question and look them
 * up in the graph before the model runs. Exact (case-insensitive) matches only,
 * so the hint is never a guess. Saves the model a whole tool round trip on the
 * common "how is A connected to B" question.
 */
import type { IndustryGraph, NodeInfo } from "@/lib/graph/engine";

const STOP = new Set(["How", "Who", "What", "Where", "When", "Is", "Are", "Was", "Were", "Connect", "Have", "Has", "Did", "Does", "The", "A", "An", "And", "To", "In", "On", "Of", "With", "From", "Between", "Both", "Kevin"]);
// "Kevin" alone is a stop word so "Kevin Bacon" still matches as a bigram but a stray "Kevin" doesn't.

export interface Hint {
  text: string;
  node: NodeInfo;
}

export function extractCandidates(question: string): string[] {
  const out = new Set<string>();
  // Quoted phrases
  for (const m of question.matchAll(/["“]([^"”]{2,60})["”]/g)) out.add(m[1].trim());
  // Runs of capitalized tokens (allow particles, apostrophes, hyphens, digits, colons)
  const tokens = question.replace(/[?!.,;]+/g, " ").split(/\s+/);
  let run: string[] = [];
  const flush = () => {
    while (run.length && STOP.has(run[0])) run.shift();
    while (run.length && STOP.has(run[run.length - 1])) run.pop();
    if (run.length) out.add(run.join(" "));
    run = [];
  };
  for (const t of tokens) {
    const cap = /^[A-ZÀ-Ý][\p{L}'’\-:.]*$/u.test(t) || /^\d{1,4}$/.test(t) && run.length > 0;
    const particle = /^(de|da|del|della|di|van|von|der|le|la|the|of|and|&|part|II|III)$/i.test(t) && run.length > 0;
    if (cap || particle) run.push(t);
    else flush();
  }
  flush();
  // Also try sub-spans of long runs (e.g. "Connect Kevin Bacon" already trimmed; "Zendaya's Euphoria" -> both)
  for (const phrase of [...out]) {
    if (phrase.includes("'s ")) for (const part of phrase.split("'s ")) out.add(part.trim());
    if (phrase.includes("’s ")) for (const part of phrase.split("’s ")) out.add(part.trim());
  }
  return [...out].filter((p) => p.length >= 3);
}

export function prehint(graph: IndustryGraph, question: string, max = 6): Hint[] {
  const hints: Hint[] = [];
  const seen = new Set<string>();
  for (const text of extractCandidates(question)) {
    const exact = graph.searchByName(text, 3).filter((n) => n.name.toLowerCase() === text.toLowerCase());
    if (exact.length === 0) continue;
    // Exact matches ranked by votes; if the top two are close, offer both so the model disambiguates.
    const top = exact[0];
    if (seen.has(top.imdbId)) continue;
    seen.add(top.imdbId);
    hints.push({ text, node: top });
    if (exact[1] && exact[1].votes > top.votes * 0.4 && !seen.has(exact[1].imdbId)) {
      seen.add(exact[1].imdbId);
      hints.push({ text, node: exact[1] });
    }
    if (hints.length >= max) break;
  }
  return hints;
}

export function formatHints(hints: Hint[]): string {
  if (hints.length === 0) return "";
  const lines = hints.map((h) => {
    const n = h.node;
    const meta = n.kind === "title" ? `${n.titleType}${n.year ? ` ${n.year}` : ""}` : `person${n.year ? ` b.${n.year}` : ""}`;
    return `- "${h.text}" → ${n.name} [${n.imdbId}, ${meta}, ${n.votes.toLocaleString()} votes]`;
  });
  return `Entities already resolved from the question (exact name matches in the graph; use these ids directly and skip find_entities for them unless the user clearly means someone else):\n${lines.join("\n")}`;
}
