/**
 * Automatic wiki pages. After every answer, the entities the answer was
 * really about get a page written or revised by a cheap model call, with the
 * question logged as provenance. The chat model no longer has to remember.
 */
import { generateText, type LanguageModel } from "ai";
import type { Brain } from "@/lib/brain/types";
import type { CanvasNode } from "./events";

export interface PageWriteInput {
  model: LanguageModel;
  brain: Brain;
  question: string;
  answer: string;
  /** Every node any tool touched this turn, in order. */
  touched: CanvasNode[];
  maxPages?: number;
  log?: (msg: string) => void;
}

/** Pick the entities the answer is actually about: named in the text, endpoints first. */
export function pickPageSubjects(touched: CanvasNode[], answer: string, max = 3): CanvasNode[] {
  const seen = new Set<string>();
  const lower = answer.toLowerCase();
  const scored = touched
    .filter((n) => {
      if (seen.has(n.imdbId)) return false;
      seen.add(n.imdbId);
      return true;
    })
    .map((n, i) => {
      const mentions = n.name.length >= 3 ? lower.split(n.name.toLowerCase()).length - 1 : 0;
      return { n, score: mentions * 10 + (i < 2 ? 3 : 0) + (n.kind === "person" ? 5 : 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((x) => x.n);
}

export async function writePagesForTurn(input: PageWriteInput): Promise<string[]> {
  const subjects = pickPageSubjects(input.touched, input.answer, input.maxPages ?? 3);
  const written: string[] = [];
  for (const subject of subjects) {
    try {
      const existing = await input.brain.readPage(subject.imdbId);
      const { text } = await generateText({
        model: input.model,
        system:
          "You maintain a wiki of film and TV people and titles. Write in tight, factual markdown: 2 to 5 short paragraphs, no headings, no bullet lists, no preamble. Only include facts that appear in the material you are given (an existing page, a question, and an answer). Never invent credits or dates. If the existing page already says something, keep it and merge the new facts in; do not repeat. Do not mention that this is a wiki page or that it was updated.",
        prompt: [
          `Entity: ${subject.name} (${subject.kind === "title" ? `${subject.titleType || "title"}${subject.year ? ` ${subject.year}` : ""}` : "person"})`,
          existing ? `Existing page:\n${existing.body}` : "Existing page: none",
          `Question just asked: ${input.question}`,
          `Answer given:\n${input.answer}`,
          `Write the ${existing ? "updated" : "new"} page for ${subject.name}.`,
        ].join("\n\n"),
        maxOutputTokens: 400,
      });
      const body = text.trim();
      if (body.length < 40 || (existing && body === existing.body)) continue;
      await input.brain.writePage({ imdbId: subject.imdbId, body, question: input.question });
      written.push(subject.imdbId);
      input.log?.(`[pages] wrote ${subject.name} (${existing ? "revised" : "new"})`);
    } catch (err) {
      input.log?.(`[pages] failed for ${subject.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return written;
}
