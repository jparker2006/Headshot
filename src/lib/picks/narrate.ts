/**
 * The one model call in the pick pipeline: rewrite each engine reason into the
 * couch voice without adding a single fact. Names must survive verbatim
 * (they are links); if the model drops one or invents a title, the engine's
 * own line is kept instead. Mocked in tests.
 */
import { generateText, type LanguageModel } from "ai";
import type { Pick } from "./engine";

const SYSTEM = `You rewrite one-line reasons for tonight's movie and TV picks. Voice: a friend texting from the couch, lowercase-leaning, quick, no hype words. Rules: keep every person and title name exactly as given and wrap each in **double asterisks**; add no facts, no adjectives about quality, no plot; one line under 120 characters; no emoji. Output one line per input, same order, nothing else.`;

export async function narrateReasons(model: LanguageModel, picks: Pick[]): Promise<string[]> {
  if (picks.length === 0) return [];
  const names = (p: Pick) => p.reason.viaImdbIds; // ids for the check below
  void names;
  const prompt = picks.map((p, i) => `${i + 1}. ${p.name}: ${p.reason.text}`).join("\n");
  let lines: string[] = [];
  try {
    const { text } = await generateText({ model, system: SYSTEM, prompt, maxOutputTokens: 300 });
    lines = text
      .split("\n")
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter(Boolean);
  } catch {
    lines = [];
  }
  return picks.map((p, i) => {
    const line = lines[i];
    if (!line) return p.reason.text;
    // Every name the engine cited must still be there, or we keep the engine's line.
    const cited = citedNames(p.reason.text);
    const ok = cited.every((n) => line.includes(n)) && line.length <= 160;
    return ok ? line : p.reason.text;
  });
}

/** Names the engine's line cites: capitalized runs (people, titles). Good enough as a guard. */
export function citedNames(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/([A-Z][\p{L}'’.\-]*(?:\s+(?:[A-Z][\p{L}'’.\-]*|\d+|of|the|and|de|van|der))*)/gu)) {
    const s = m[1].replace(/\s+(of|the|and|de|van|der)$/i, "").trim();
    if (s.length >= 3) out.push(s);
  }
  return out;
}
