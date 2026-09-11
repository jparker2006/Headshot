/**
 * The answer store's helpers (v2): cache keys, slugs and short ids, the
 * public-permalink gate, and replaying a stored answer into a UI stream.
 */
import type { UIMessageStreamWriter } from "ai";
import type { AnswerShape, HeadshotUIMessage } from "./events";
import type { RecordedEvent, StoredAnswer } from "@/lib/brain/types";

/** Shapes whose answer is deterministic enough to replay. `identify` is not (yet). */
export const CACHEABLE: ReadonlySet<AnswerShape> = new Set(["path", "costar", "both", "known-for"]);

/** Cache key: shape plus sorted entity ids, never the raw question text. */
export function cacheKey(shape: AnswerShape, imdbIds: string[]): string {
  return `${shape}:${[...imdbIds].sort().join(",")}`;
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** A readable slug for the shape: "heath-ledger-to-natalie-portman", "who-was-in-both-x-and-y". */
export function answerSlug(shape: AnswerShape, names: string[]): string {
  const [a, b] = names;
  switch (shape) {
    case "path":
      return slugify(`${a} to ${b}`);
    case "costar":
      return slugify(`${a} and ${b}`);
    case "both":
      return slugify(`who was in both ${a} and ${b}`);
    case "known-for":
      return slugify(`${a} known for`);
    case "identify":
      return slugify(`who in ${a}`);
  }
}

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"; // no 0/1/i/l/o: readable when typed

export function shortId(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

const PROFANITY = /\b(fuck\w*|shit\w*|cunt\w*|nigg\w*|fag\w*|retard\w*|bitch\w*|asshole\w*|dick\w*|cock\w*|pussy|whore|slut\w*|rape\w*|nazi\w*|kike\w*|spic\w*|chink\w*)\b/i;
export const MAX_PUBLIC_QUESTION_LENGTH = 160;

/** Public permalinks only for short, clean questions; everything else stays private to the session. */
export function isPublicSafe(question: string): boolean {
  const q = question.trim();
  return q.length > 0 && q.length <= MAX_PUBLIC_QUESTION_LENGTH && !PROFANITY.test(q);
}

/** Events worth replaying: everything the canvas animates, minus transient status lines. */
export function isReplayable(type: string): boolean {
  return type !== "status" && type !== "fast";
}

/** Split text into word-ish chunks so a replay still streams instead of appearing at once. */
export function chunkText(text: string, size = 24): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/**
 * Replay a stored answer as if the agent had just produced it: the canvas
 * events in order, then the narration as text, then the follow-ups.
 */
export function replayAnswer(writer: UIMessageStreamWriter<HeadshotUIMessage>, answer: StoredAnswer, opts: { stale?: boolean } = {}): void {
  type Part = Parameters<typeof writer.write>[0];
  writer.write({ type: "data-fast", data: { shape: answer.shape as AnswerShape, imdbIds: answer.entityIds, cached: true, answerId: answer.id, stale: opts.stale } } as Part);
  for (const e of answer.events as RecordedEvent[]) {
    writer.write({ type: `data-${e.type}`, data: e.data } as Part);
  }
  const id = `replay-${answer.id}`;
  writer.write({ type: "text-start", id });
  for (const piece of chunkText(answer.narration)) writer.write({ type: "text-delta", id, delta: piece });
  writer.write({ type: "text-end", id });
  if (answer.followups.length) writer.write({ type: "data-followups", data: { questions: answer.followups } });
}
