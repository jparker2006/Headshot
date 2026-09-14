import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { backs, parseClaims, renderClaimsMarkdown, rewriteMemory, validateClaims } from "@/lib/memory";
import { fixtureGraph } from "./helpers";

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };

function textModel(text: string | (() => string)) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: typeof text === "function" ? text() : text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

const APOLLO = "tt0000001";
const GUMP = "tt0000002";
/** Rated 5: proof of an avoid, never of a love. */
const MEH = "tt0000003";
/** A `want` row: no score, proof of nothing. */
const WANT = "tt0000004";
const STALE = "tt9999999";

/** Deterministic ids, so a test can say which claim is which. */
function counter() {
  let n = 0;
  return () => `c_${String(++n).padStart(8, "0")}`;
}

const ctx = (over: Partial<Parameters<typeof validateClaims>[1]> = {}) => ({
  knownIds: [APOLLO, GUMP, MEH, WANT],
  scores: new Map<string, number | null>([
    [APOLLO, 9.9],
    [GUMP, 10],
    [MEH, 5],
    [WANT, null],
  ]),
  newId: counter(),
  ...over,
});

describe("validateClaims", () => {
  it("drops a stale evidence id and keeps the rest of the claim", () => {
    const out = validateClaims({ sentence: "you like a long fuse", claims: [{ text: "space procedurals", evidence: [APOLLO, STALE], polarity: "love" }] }, ctx());
    expect(out.claims).toHaveLength(1);
    expect(out.claims[0].evidence).toEqual([APOLLO]);
    expect(out.sentence).toBe("you like a long fuse");
  });

  it("drops a claim whose only evidence is stale", () => {
    const out = validateClaims({ claims: [{ text: "westerns, every time", evidence: [STALE], polarity: "love" }] }, ctx());
    expect(out.claims).toEqual([]);
  });

  it("cites a person id the summary knows", () => {
    const out = validateClaims({ claims: [{ text: "keeps turning up for the same faces", evidence: ["nm0000001"], polarity: "love" }] }, ctx({ knownIds: [APOLLO, "nm0000001"] }));
    expect(out.claims[0].evidence).toEqual(["nm0000001"]);
  });

  it("keeps a love claim to rows rated 7 or over, and an avoid to rows under 7", () => {
    const out = validateClaims(
      {
        claims: [
          // A 5 under a love: the id goes, the claim stays on what is left.
          { text: "momentum and craft in the same film", evidence: [APOLLO, MEH], polarity: "love" },
          // A 10 under an avoid: same rule the other way round.
          { text: "costume spectacle falls flat", evidence: [GUMP, MEH], polarity: "avoid" },
          // Only a 5 behind a love: nothing left, so no claim.
          { text: "crime in the Midwest, dry and patient", evidence: [MEH], polarity: "love" },
        ],
      },
      ctx(),
    );
    expect(out.claims.map((c) => [c.text, c.evidence])).toEqual([
      ["momentum and craft in the same film", [APOLLO]],
      ["costume spectacle falls flat", [MEH]],
    ]);
  });

  it("treats a row with no score as proof of nothing, and a person as a liking", () => {
    const out = validateClaims(
      {
        claims: [
          { text: "westerns, every time", evidence: [WANT, APOLLO], polarity: "love" },
          { text: "long-running shows that stall", evidence: [WANT], polarity: "avoid" },
          { text: "keeps turning up for the same faces", evidence: ["nm0000001"], polarity: "love" },
          { text: "avoids the same faces", evidence: ["nm0000001"], polarity: "avoid" },
        ],
      },
      ctx({ knownIds: [APOLLO, WANT, "nm0000001"] }),
    );
    expect(out.claims.map((c) => [c.text, c.evidence])).toEqual([
      ["westerns, every time", [APOLLO]],
      ["keeps turning up for the same faces", ["nm0000001"]],
    ]);
  });

  it("scores by threshold: 7 backs a love, 6.9 backs an avoid", () => {
    expect(backs("love", 7)).toBe(true);
    expect(backs("love", 6.9)).toBe(false);
    expect(backs("avoid", 6.9)).toBe(true);
    expect(backs("avoid", 7)).toBe(false);
    expect(backs("love", null)).toBe(false);
    expect(backs("avoid", null)).toBe(false);
    expect(backs("love", undefined)).toBe(true);
    expect(backs("avoid", undefined)).toBe(false);
  });

  it("never lets a rejected claim back, in any wording", () => {
    const previous = { sentence: "", claims: [], rejected: [{ text: "musicals" }] };
    const out = validateClaims(
      {
        claims: [
          { text: "musicals", evidence: [APOLLO], polarity: "love" },
          { text: "loves musicals, whatever the decade", evidence: [APOLLO], polarity: "love" },
          { text: "space procedurals", evidence: [APOLLO], polarity: "love" },
        ],
      },
      ctx({ previous }),
    );
    expect(out.claims.map((c) => c.text)).toEqual(["space procedurals"]);
    // The rejected list is the store's and is carried forward untouched.
    expect(out.rejected).toEqual([{ text: "musicals" }]);
  });

  it("caps at 8 claims and 2 avoids, drops a 13-word text, truncates a 21-word sentence", () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({ text: `pattern number ${i}`, evidence: [APOLLO], polarity: "love" as const }));
    expect(validateClaims({ claims: nine }, ctx()).claims).toHaveLength(8);

    const avoids = Array.from({ length: 3 }, (_, i) => ({ text: `dislike number ${i}`, evidence: [MEH], polarity: "avoid" as const }));
    const out = validateClaims({ claims: avoids }, ctx());
    expect(out.claims).toHaveLength(2);
    expect(out.claims.every((c) => c.polarity === "avoid")).toBe(true);

    const long = Array.from({ length: 13 }, (_, i) => `w${i}`).join(" ");
    const twelve = Array.from({ length: 12 }, (_, i) => `w${i}`).join(" ");
    const capped = validateClaims({ claims: [{ text: long, evidence: [APOLLO], polarity: "love" }, { text: twelve, evidence: [APOLLO], polarity: "love" }] }, ctx());
    // Too long is dropped, never truncated; exactly twelve survives.
    expect(capped.claims.map((c) => c.text)).toEqual([twelve]);

    const sentence = Array.from({ length: 21 }, (_, i) => `s${i}`).join(" ");
    expect(validateClaims({ sentence, claims: [] }, ctx()).sentence.split(" ")).toHaveLength(20);
  });

  it("strips bold markers from the text and the sentence", () => {
    const out = validateClaims({ sentence: "you love **Heat**", claims: [{ text: "**crime** with a long fuse", evidence: [APOLLO], polarity: "love" }] }, ctx());
    expect(out.sentence).toBe("you love Heat");
    expect(out.claims[0].text).toBe("crime with a long fuse");
  });

  it("reuses the previous id when the text matches, case-insensitively", () => {
    const previous = {
      sentence: "",
      claims: [{ id: "c_deadbeef", text: "Crime With A Long Fuse", evidence: [APOLLO], polarity: "love" as const }],
      rejected: [],
    };
    const out = validateClaims(
      { claims: [{ text: "crime with a long fuse", evidence: [GUMP], polarity: "love" }, { text: "space procedurals", evidence: [APOLLO], polarity: "love" }] },
      ctx({ previous }),
    );
    expect(out.claims[0].id).toBe("c_deadbeef");
    expect(out.claims[1].id).toMatch(/^c_/);
    expect(out.claims[1].id).not.toBe("c_deadbeef");
  });

  it("survives junk: no claims array, a non-object entry, a duplicate text", () => {
    expect(validateClaims({}, ctx()).claims).toEqual([]);
    expect(validateClaims(null, ctx()).claims).toEqual([]);
    const out = validateClaims({ claims: [null, 7, { text: "a", evidence: [APOLLO] }, { text: "A", evidence: [GUMP], polarity: "love" }] }, ctx());
    expect(out.claims).toHaveLength(1);
    // A polarity the model did not give is `love`, never `avoid`.
    expect(out.claims[0].polarity).toBe("love");
  });
});

describe("renderClaimsMarkdown", () => {
  const lookup = (id: string) =>
    ({
      [APOLLO]: { name: "Apollo 13", score: 9.9 },
      [GUMP]: { name: "Forrest Gump", score: 10 },
      "nm1": { name: "Tom Hanks", score: null },
    })[id];

  it("orders evidence by score descending and renders one decimal only when there is one", () => {
    const markdown = renderClaimsMarkdown(
      {
        sentence: "you like a long fuse",
        claims: [
          { id: "c_1", text: "crime with a long fuse", evidence: [APOLLO, GUMP, "nm1"], polarity: "love" },
          { id: "c_2", text: "musicals", evidence: [GUMP], polarity: "avoid" },
        ],
        rejected: [],
      },
      lookup,
    );
    expect(markdown).toBe(
      [
        "you like a long fuse",
        "",
        "## What you love",
        "crime with a long fuse: **Forrest Gump** 10, **Apollo 13** 9.9, **Tom Hanks**.",
        "",
        "## What you avoid",
        "musicals: **Forrest Gump** 10.",
      ].join("\n"),
    );
  });

  it("omits a section it has nothing for, and the sentence when there is none", () => {
    const markdown = renderClaimsMarkdown({ sentence: "", claims: [{ id: "c_1", text: "westerns", evidence: [APOLLO], polarity: "love" }], rejected: [] }, lookup);
    expect(markdown).toBe("## What you love\nwesterns: **Apollo 13** 9.9.");
    expect(renderClaimsMarkdown({ sentence: "", claims: [], rejected: [] }, lookup)).toBe("");
  });
});

describe("parseClaims", () => {
  it("reads a bare object, a fenced one, and one with chatter around it", () => {
    expect(parseClaims('{"sentence":"a"}')).toEqual({ sentence: "a" });
    expect(parseClaims('```json\n{"sentence":"a"}\n```')).toEqual({ sentence: "a" });
    expect(parseClaims('here you go:\n{"sentence":"a"}\nhope that helps')).toEqual({ sentence: "a" });
  });

  it("is null for junk, an array, and an empty answer", () => {
    expect(parseClaims("not json at all")).toBeNull();
    expect(parseClaims("[1,2,3]")).toBeNull();
    expect(parseClaims("")).toBeNull();
  });
});

describe("rewrite with claims end to end", () => {
  it("parses JSON out of a fence", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    const payload = JSON.stringify({ sentence: "you like a countdown", claims: [{ text: "space procedurals", evidence: [APOLLO], polarity: "love" }] });
    const result = await rewriteMemory({ store, graph, model: textModel("```json\n" + payload + "\n```") }, "u1");
    expect(result!.markdown).toBe("you like a countdown\n\n## What you love\nspace procedurals: **Apollo 13** 8.");
  });

  it("leaves the memory untouched when the model returns malformed JSON", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    await store.setMemory("u1", { markdown: "the old prose", rowsHash: "old" });
    expect(await rewriteMemory({ store, graph, model: textModel("sorry, I can't do that") }, "u1")).toBeNull();
    const row = (await store.getMemory("u1"))!;
    expect(row.markdown).toBe("the old prose");
    expect(row.claims).toBeNull();
    expect(row.rowsHash).toBe("old");
  });

  it("reports a title the previous claims cited that the log no longer holds", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    await store.setMemory("u1", {
      markdown: "prose",
      claims: {
        sentence: "you like a countdown",
        claims: [{ id: "c_1", text: "space procedurals", evidence: [APOLLO, GUMP], polarity: "love" }],
        rejected: [{ text: "musicals" }],
      },
    });
    const model = textModel(JSON.stringify({ sentence: "you like a countdown", claims: [{ text: "space procedurals", evidence: [APOLLO], polarity: "love" }] }));
    const result = (await rewriteMemory({ store, graph, model }, "u1"))!;
    // Forrest Gump was evidence and is not a row any more.
    expect(result.dropped).toEqual(["Forrest Gump"]);
    // The id survives because the text did, and the rejected list rides along.
    expect(result.claims.claims[0].id).toBe("c_1");
    expect(result.claims.rejected).toEqual([{ text: "musicals" }]);

    // The prompt shows the model both lists.
    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(prompt).toContain("rejected");
    expect(prompt).toContain("musicals");
  });

  it("with claims stored, only their evidence can be dropped — the prose is not scanned", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    // The stored markdown is rendered from the claims and names people in bold
    // exactly as it names titles. A person's name can be a title's too ("Stan
    // Lee" is a documentary), so the bold scan of the prose would report a
    // person as a dropped title. Here the prose names a bold title that is not
    // a row, and it must still not be reported: the claims say what fell out.
    await store.setMemory("u1", {
      markdown: "## What you love\nkeeps turning up for the same faces: **Tom Hanks**, **Forrest Gump**.",
      claims: {
        sentence: "",
        claims: [{ id: "c_1", text: "keeps turning up for the same faces", evidence: ["nm0000002"], polarity: "love" }],
        rejected: [],
      },
    });
    const model = textModel(JSON.stringify({ sentence: "you like a countdown", claims: [{ text: "space procedurals", evidence: [APOLLO], polarity: "love" }] }));
    const result = (await rewriteMemory({ store, graph, model }, "u1"))!;
    expect(result.dropped).toEqual([]);
  });

  it("a rejected claim does not come back on the next rewrite", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    const model = textModel(
      JSON.stringify({
        sentence: "you like a countdown",
        claims: [
          { text: "space procedurals", evidence: [APOLLO], polarity: "love" },
          { text: "musicals", evidence: [APOLLO], polarity: "love" },
        ],
      }),
    );
    const first = (await rewriteMemory({ store, graph, model }, "u1"))!;
    expect(first.claims.claims.map((c) => c.text)).toEqual(["space procedurals", "musicals"]);

    // The user says "not me", the way the route does it.
    const row = (await store.getMemory("u1"))!;
    const musicals = row.claims!.claims.find((c) => c.text === "musicals")!;
    await store.setMemory("u1", {
      claims: { ...row.claims!, claims: row.claims!.claims.filter((c) => c.id !== musicals.id), rejected: [{ text: musicals.text }] },
      rowsHash: "",
    });

    // The model proposes it again anyway; validation drops it.
    const second = (await rewriteMemory({ store, graph, model }, "u1"))!;
    expect(second.claims.claims.map((c) => c.text)).toEqual(["space procedurals"]);
    expect(second.markdown).not.toContain("musicals");
  });
});
