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
  const prompt = picks.map((p, i) => `${i + 1}. ${p.name}: ${p.reason.text}`).join("\n");
  let lines: string[] = [];
  try {
    // A thinking model spends its whole budget reasoning about two lines; turn that off for this call.
    const { text } = await generateText({ model, system: SYSTEM, prompt, maxOutputTokens: 400, providerOptions: { openrouter: { reasoning: { enabled: false } } } });
    lines = text
      .split("\n")
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter(Boolean);
    // The model likes to echo "**Title**: " in front; the title is rendered separately.
    lines = lines.map((l, i) => l.replace(new RegExp(`^\\*{0,2}${picks[i]?.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") ?? ""}\\*{0,2}\\s*[:.,-]\\s*`, "i"), ""));
  } catch {
    lines = [];
  }
  return picks.map((p, i) => {
    const line = lines[i];
    if (!line) return p.reason.text;
    // Every name the engine cited must still be there, or we keep the engine's line.
    const cited = citedNames(p.reason.text);
    const plain = line.replace(/\*\*/g, "");
    const ok = cited.every((n) => plain.includes(n)) && line.length <= 180;
    return ok ? line : p.reason.text;
  });
}

/** Names the engine's line cites: capitalized runs (people, titles). Good enough as a guard. */
export function citedNames(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/([A-Z][\p{L}'’.\-]*(?:\s+(?:[A-Z][\p{L}'’.\-]*|\d+))*)/gu)) {
    const s = m[1].trim();
    if (s.length >= 3) out.push(s);
  }
  return out;
}
