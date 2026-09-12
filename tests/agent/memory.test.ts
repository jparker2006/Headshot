import { describe, it, expect } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { GUARD_MS, memoryText, PINNED_HEADING, rewriteMemory } from "@/lib/memory";
import { extractEpisodes, looksLikeTaste, parseEpisodes, titleCandidates } from "@/lib/memory";
import { collect, fixtureGraph, ofType, scriptedModel, userMessage } from "./helpers";
import { MemoryBrain } from "@/lib/brain";
import { MEMORY_HEADING, runAgent } from "@/lib/agent";

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };

/** A model that answers every generateText call with the same text. */
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

describe("memory rewrite", () => {
  it("writes the model's markdown and keeps the pinned block verbatim", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    await store.setMemory("u1", { markdown: "old notes", pinned: "i will never watch a musical.\n- **Heat** is the best film ever made." });
    await store.addEpisodes("u1", [{ kind: "log", titleImdbId: APOLLO, text: "liked Apollo 13 (1995)" }]);

    const model = textModel("## What you love\n- space procedurals, **Apollo 13** most of all.");
    const markdown = await rewriteMemory({ store, graph, model }, "u1");

    expect(markdown).toContain("space procedurals");
    expect(markdown).toContain(PINNED_HEADING);
    expect(markdown).toContain("i will never watch a musical.\n- **Heat** is the best film ever made.");
    const row = (await store.getMemory("u1"))!;
    expect(row.markdown).toBe(markdown);
    // The pinned lines stay in their own column too, untouched.
    expect(row.pinned).toContain("never watch a musical");
    // The model saw the pinned block as context but was told not to rewrite it.
    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(prompt).toContain("never watch a musical");
    expect(prompt).toContain("liked Apollo 13");
  });

  it("caps the body at 40 lines before the pinned block", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    await store.setMemory("u1", { pinned: "pinned line" });
    await store.addEpisodes("u1", [{ kind: "log", text: "liked Apollo 13" }]);
    const long = Array.from({ length: 80 }, (_, i) => `- line ${i + 1}`).join("\n");
    const markdown = (await rewriteMemory({ store, graph, model: textModel(long) }, "u1"))!;
    const [body, pinned] = markdown.split(`\n\n${PINNED_HEADING}\n`);
    expect(body.split("\n")).toHaveLength(40);
    expect(body).toContain("- line 40");
    expect(body).not.toContain("- line 41");
    expect(pinned).toBe("pinned line");
  });

  it("skips when the row was just written and nothing is newer", async () => {
    const graph = await fixtureGraph();
    // A clock that ticks a second per write, so the row and the episodes never
    // land in the same millisecond.
    let tick = Date.parse("2026-09-11T20:00:00.000Z");
    const clock = () => new Date((tick += 1000));
    const store = new MemoryTasteStore({ now: clock });
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    await store.addEpisodes("u1", [{ kind: "log", text: "liked Apollo 13" }]);
    await store.setMemory("u1", { markdown: "notes" });
    const model = textModel("new notes");
    const now = () => new Date(tick);
    expect(await rewriteMemory({ store, graph, model, now }, "u1")).toBeNull();
    expect(model.doGenerateCalls).toHaveLength(0);

    // An episode newer than the row is new evidence: the guard lets it through.
    await store.addEpisodes("u1", [{ kind: "chat", text: "loved Forrest Gump" }]);
    expect(await rewriteMemory({ store, graph, model, now }, "u1")).toContain("new notes");

    // The row is fresh again and nothing is newer: the second request of a
    // double-fire does nothing, whether it is inside the guard window or past it.
    expect(await rewriteMemory({ store, graph, model, now }, "u1")).toBeNull();
    expect(await rewriteMemory({ store, graph, model, now: () => new Date(tick + GUARD_MS * 2) }, "u1")).toBeNull();
  });

  it("never throws when the model fails", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    const model = new MockLanguageModelV4({ doGenerate: async () => { throw new Error("boom"); } });
    await expect(rewriteMemory({ store, graph, model }, "u1")).resolves.toBeNull();
  });

  it("memoryText joins the markdown with pinned lines it does not already carry", async () => {
    const store = new MemoryTasteStore();
    expect(await memoryText(store, "u1")).toBe("");
    await store.setMemory("u1", { markdown: "notes", pinned: "i hate musicals" });
    expect(await memoryText(store, "u1")).toBe(`notes\n\n${PINNED_HEADING}\ni hate musicals`);
    await store.setMemory("u1", { markdown: `notes\n\n${PINNED_HEADING}\ni hate musicals` });
    expect(await memoryText(store, "u1")).toBe(`notes\n\n${PINNED_HEADING}\ni hate musicals`);
  });
});

describe("episode extraction", () => {
  it("knows which messages are worth a model call", () => {
    expect(looksLikeTaste("i loved it, honestly")).toBe(true);
    expect(looksLikeTaste("watched forrest gump last night")).toBe(true);
    expect(looksLikeTaste("Apollo 13 is my favourite")).toBe(true);
    expect(looksLikeTaste('that "the bear" episode broke me')).toBe(true);
    expect(looksLikeTaste("how is she connected to him")).toBe(false);
    expect(looksLikeTaste("who is that guy")).toBe(false);
    expect(looksLikeTaste("ok")).toBe(false);
  });

  it("skips the model entirely when the message has nothing in it", async () => {
    const model = textModel("{}");
    expect(await extractEpisodes(model, "how is she connected to him")).toEqual([]);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("returns statements and maps titles to ids when unambiguous", async () => {
    const graph = await fixtureGraph();
    const message = "i loved Apollo 13, and I dropped Good Series after season 1";
    const known = titleCandidates(graph, message);
    expect(known.map((k) => k.imdbId)).toContain(APOLLO);
    const model = textModel(
      '{"text":"loved Apollo 13","title":"Apollo 13"}\n{"text":"dropped Good Series after season 1","title":"Good Series"}\n{"text":"wants something like The Nonexistent Film","title":"The Nonexistent Film"}',
    );
    const out = await extractEpisodes(model, message, { knownTitles: known });
    // Each statement also carries what it is worth out of ten (SPEC v5):
    // "loved" is a 9, and a statement with no opinion in it has no score.
    expect(out).toEqual([
      { text: "loved Apollo 13", titleImdbId: APOLLO, score: 9 },
      { text: "dropped Good Series after season 1", titleImdbId: "tt0000009", score: null },
      { text: "wants something like The Nonexistent Film", titleImdbId: null, score: null },
    ]);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("returns nothing when the model fails or says nothing", async () => {
    const bad = new MockLanguageModelV4({ doGenerate: async () => { throw new Error("boom"); } });
    await expect(extractEpisodes(bad, "i loved Apollo 13")).resolves.toEqual([]);
    await expect(extractEpisodes(textModel("nothing worth keeping"), "i loved Apollo 13")).resolves.toEqual([]);
  });

  it("parses a JSON array, trims to 140 characters, and refuses ambiguous titles", () => {
    const long = "x".repeat(200);
    const known = [
      { imdbId: APOLLO, name: "Apollo 13", year: 1995 },
      { imdbId: GUMP, name: "Twin", year: 1990 },
      { imdbId: "tt0000003", name: "Twin", year: 1999 },
    ];
    const out = parseEpisodes(`[{"text":"${long}","title":"Twin"},{"text":"liked it","title":"apollo 13"}]`, known);
    expect(out[0].text).toHaveLength(140);
    expect(out[0].titleImdbId).toBeNull();
    expect(out[1].titleImdbId).toBe(APOLLO);
  });
});

describe("memory in the chat", () => {
  it("carries the memory under its heading and runs recall newest-first", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    await store.setMemory("u1", { markdown: "## What you love\n- space procedurals", pinned: "no musicals, ever" });
    await store.addEpisodes("u1", [
      { kind: "log", titleImdbId: APOLLO, text: "liked Apollo 13 (1995)", at: "2026-01-01T00:00:00.000Z" },
      { kind: "chat", titleImdbId: GUMP, text: "loved Forrest Gump", at: "2026-02-01T00:00:00.000Z" },
      { kind: "swipe", text: "swiped: liked Apollo 13", at: "2026-03-01T00:00:00.000Z" },
    ]);

    const model = scriptedModel([{ tool: "recall", input: { query: "" } }, { text: "you loved **Forrest Gump**." }]);
    const chunks = await collect(
      runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("what do i like")], followups: false, userId: "u1", taste: store, schedule: () => {} }),
    );

    const system = String(model.doStreamCalls[0].prompt.find((m) => m.role === "system")?.content);
    expect(system).toContain(MEMORY_HEADING);
    expect(system).toContain("space procedurals");
    expect(system).toContain("no musicals, ever");
    // The facts block is still there too.
    expect(system).toContain("This user is signed in");

    const out = ofType(chunks, "tool-output-available")[0].output as { episodes: string[] };
    expect(out.episodes).toEqual([
      "2026-03-01 [swipe] swiped: liked Apollo 13",
      "2026-02-01 [chat] loved Forrest Gump",
      "2026-01-01 [log] liked Apollo 13 (1995)",
    ]);

    const filtered = await store.listEpisodes("u1", { query: "gump" });
    expect(filtered.map((e) => e.text)).toEqual(["loved Forrest Gump"]);
  });

  it("after the turn: the message becomes episodes and the memory is rewritten", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    const model = scriptedModel([{ text: "nice." }]);
    // The background half runs on the side model: extraction first, then the rewrite.
    let call = 0;
    const side = textModel(() => (++call === 1 ? '{"text":"loved Apollo 13","title":"Apollo 13"}' : "## What you love\n- space procedurals"));
    const jobs: Promise<void>[] = [];

    await collect(
      runAgent({
        model,
        sideModel: side,
        graph,
        brain: new MemoryBrain(),
        tmdb: null,
        messages: [userMessage("i loved Apollo 13")],
        followups: false,
        userId: "u1",
        taste: store,
        schedule: (work) => jobs.push(work()),
      }),
    );
    await Promise.all(jobs);

    expect((await store.listEpisodes("u1")).map((e) => ({ kind: e.kind, text: e.text, titleImdbId: e.titleImdbId }))).toEqual([
      { kind: "chat", text: "loved Apollo 13", titleImdbId: APOLLO },
    ]);
    expect((await store.getMemory("u1"))?.markdown).toContain("space procedurals");
    expect(side.doGenerateCalls).toHaveLength(2);
  });

  it("log writes an episode as well as the row", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    const model = scriptedModel([{ tool: "log", input: { imdbId: GUMP, score: 9, note: "still cries at the bench" } }, { text: "noted." }]);
    await collect(
      runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("i loved forrest gump")], followups: false, userId: "u1", taste: store, memory: false }),
    );
    expect((await store.listEpisodes("u1")).map((e) => e.text)).toEqual(['rated Forrest Gump (1994) 9/10: "still cries at the bench"']);
  });
});
