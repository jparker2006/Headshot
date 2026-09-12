/**
 * The evidence layer's ear on the chat (SPEC v4): after a turn, pull the
 * taste statements out of what the user said and store them as episodes.
 *
 * Two guards keep this cheap. `looksLikeTaste` skips the model entirely for a
 * message that carries neither a title-shaped phrase nor a taste verb ("how is
 * a connected to b" never reaches the model). When it does run it is one cheap
 * call with reasoning off, and a failure returns nothing rather than throwing.
 */
import { generateText, type LanguageModel } from "ai";
import { scoreFromStatement } from "@/lib/taste/score";

export interface ExtractedEpisode {
  text: string;
  titleImdbId?: string | null;
  /**
   * What the statement is worth out of ten (SPEC v5: loved 9, liked 8, fine 6,
   * didn't like 4, hated 2), or null when it states no opinion at all — "i
   * watched Heat last night" is evidence, not a rating. Nothing is written to
   * the log from this: the score is here so the memory rewrite and the `log`
   * tool read one statement the same way.
   */
  score?: number | null;
}

export interface KnownTitle {
  imdbId: string;
  name: string;
  year: number;
}

/** Longest an episode line may be; the memory is a page, not a transcript. */
export const MAX_EPISODE_CHARS = 140;

/** Most statements we keep from one message. */
export const MAX_EPISODES_PER_MESSAGE = 5;

const TASTE_VERBS =
  /\b(love[ds]?|loving|like[ds]?|liked|hate[ds]?|hating|watch(?:ed|ing)?|rewatch(?:ed|ing)?|seen|saw|finish(?:ed)?|start(?:ed)?|drop(?:ped)?|quit|bored|boring|great|amazing|brilliant|terrible|awful|mid|meh|favou?rite|obsessed|binge[d]?|recommend(?:ed)?|into|can'?t stand|not for me|my thing|want to (?:watch|see))\b/i;

/** Two or more capitalised words in a row: the shape of a title or a name. */
const CAPITALISED_PHRASE = /\b[A-Z][\p{L}'’.-]*(?:\s+(?:of|the|and|a|an|in|on|to|de|di|la|le)\s+|\s+)[A-Z0-9][\p{L}0-9'’.-]*/u;

/** A quoted phrase is a title even in lowercase ("i loved "the bear""). */
const QUOTED = /["“'‘]([^"”'’]{2,60})["”'’]/;

/**
 * Worth a model call? True when the message names something (a capitalised
 * multi-word phrase or a quoted one) or says something about taste.
 */
export function looksLikeTaste(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return false;
  return TASTE_VERBS.test(t) || CAPITALISED_PHRASE.test(t) || QUOTED.test(t);
}

const SYSTEM = `You read one message a person sent to a friend about film and TV, and pull out only the statements worth remembering about their taste: what they watched, liked, hated, dropped, are in the middle of, or want to see, and opinions they stated about a title or a person.

Output one JSON object per line, nothing else, no code fence:
{"text": "...", "title": "..."}
- "text": the statement in their own words where possible, under 140 characters, first person.
- "title": the film or show it is about, exactly as they wrote it, or null.
Ignore trivia questions, requests for recommendations, and anything that is not about their own taste. If there is nothing worth remembering, output nothing at all.`;

/**
 * Pull episodes out of a user message. Returns [] when the heuristic says
 * there is nothing to find, when the model says so, or when the call fails.
 */
export async function extractEpisodes(
  model: LanguageModel,
  userMessage: string,
  opts: { knownTitles?: KnownTitle[] } = {},
): Promise<ExtractedEpisode[]> {
  const message = userMessage.trim();
  if (!looksLikeTaste(message)) return [];
  let text = "";
  try {
    const result = await generateText({
      model,
      system: SYSTEM,
      prompt: message,
      maxOutputTokens: 400,
      providerOptions: { openrouter: { reasoning: { enabled: false } } },
    });
    text = result.text;
  } catch {
    return [];
  }
  return parseEpisodes(text, opts.knownTitles ?? []);
}

/** Parse the model's JSON lines (or a JSON array) and resolve the titles. */
export function parseEpisodes(raw: string, knownTitles: KnownTitle[] = []): ExtractedEpisode[] {
  const objects: Record<string, unknown>[] = [];
  const body = raw.replace(/^```[a-z]*\n?|```$/gim, "").trim();
  const asArray = tryJson(body);
  if (Array.isArray(asArray)) {
    for (const item of asArray) if (item && typeof item === "object") objects.push(item as Record<string, unknown>);
  } else {
    for (const line of body.split("\n")) {
      const parsed = tryJson(line.trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) objects.push(parsed as Record<string, unknown>);
    }
  }

  const out: ExtractedEpisode[] = [];
  for (const obj of objects) {
    const text = typeof obj.text === "string" ? obj.text.trim().slice(0, MAX_EPISODE_CHARS) : "";
    if (!text) continue;
    const title = typeof obj.title === "string" ? obj.title : null;
    // Scored on the statement with its title taken out: "dropped Good Series"
    // is not a "good", and a film called Awful is not a 2.
    out.push({ text, titleImdbId: title ? matchTitle(title, knownTitles) : null, score: scoreFromStatement(withoutTitle(text, title)) });
    if (out.length >= MAX_EPISODES_PER_MESSAGE) break;
  }
  return out;
}

/** The statement with the title it is about removed, for scoring only. */
function withoutTitle(text: string, title: string | null): string {
  if (!title) return text;
  return text.split(title).join(" ");
}

function tryJson(s: string): unknown {
  if (!s.startsWith("{") && !s.startsWith("[")) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Exactly one candidate with this name wins; anything ambiguous stays null. */
export function matchTitle(name: string, knownTitles: KnownTitle[]): string | null {
  const q = normalize(name);
  if (!q) return null;
  const exact = knownTitles.filter((t) => normalize(t.name) === q);
  const ids = new Set(exact.map((t) => t.imdbId));
  return ids.size === 1 ? exact[0].imdbId : null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The graph slice the candidate lookup needs. */
export interface NameLookup {
  searchByName(query: string, limit?: number, kind?: "person" | "title"): { imdbId: string; name: string; year: number }[];
}

/**
 * Candidate titles for a message: every capitalised or quoted phrase in it,
 * looked up in the graph. Passed to `extractEpisodes` as `knownTitles`, so the
 * model's title string only ever resolves against things it could plausibly be.
 */
export function titleCandidates(graph: NameLookup, text: string, limit = 24): KnownTitle[] {
  const phrases = new Set<string>();
  for (const m of text.matchAll(/["“'‘]([^"”'’]{2,60})["”'’]/g)) phrases.add(m[1].trim());
  for (const m of text.matchAll(/\b[A-Z][\p{L}0-9'’.-]*(?:\s+(?:of|the|and|a|an|in|on|to|de|di|la|le|part|vol\.?)?\s*[A-Z0-9][\p{L}0-9'’.-]*)+/gu)) {
    phrases.add(m[0].trim());
  }
  // A short lowercase message is often just a title ("i loved dune part two").
  const stripped = text.replace(/^(i\s+)?(really\s+)?(loved|liked|hated|watched|finished|dropped|saw|rewatched)\s+/i, "").trim();
  if (stripped && stripped !== text.trim() && stripped.length <= 60) phrases.add(stripped);

  const out = new Map<string, KnownTitle>();
  for (const phrase of phrases) {
    if (phrase.length < 2) continue;
    for (const hit of graph.searchByName(phrase, 4, "title")) {
      out.set(hit.imdbId, { imdbId: hit.imdbId, name: hit.name, year: hit.year });
      if (out.size >= limit) return [...out.values()];
    }
  }
  return [...out.values()];
}
