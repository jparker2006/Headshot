import { describe, it, expect } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { memoryText, PINNED_HEADING, rewriteMemory } from "@/lib/memory";
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
    const result = await rewriteMemory({ store, graph, model }, "u1");
    const markdown = result!.markdown;

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
    // v5.2: the rows are the prompt's primary input, not the log episode.
    expect(prompt).toContain("Apollo 13 (1995)");
    expect(prompt).toContain("8/10");
    expect(prompt).toContain("This is the truth");
  });

  it("caps the body at 40 lines before the pinned block", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    await store.setMemory("u1", { pinned: "pinned line" });
    await store.addEpisodes("u1", [{ kind: "log", text: "liked Apollo 13" }]);
    const long = Array.from({ length: 80 }, (_, i) => `- line ${i + 1}`).join("\n");
    const markdown = (await rewriteMemory({ store, graph, model: textModel(long) }, "u1"))!.markdown;
    const [body, pinned] = markdown.split(`\n\n${PINNED_HEADING}\n`);
    expect(body.split("\n")).toHaveLength(40);
    expect(body).toContain("- line 40");
    expect(body).not.toContain("- line 41");
    expect(pinned).toBe("pinned line");
  });

  it("skips when the rows are the ones it already wrote about", async () => {
    const graph = await fixtureGraph();
    // A clock that ticks a second per write, so the row and the episodes never
    // land in the same millisecond.
    let tick = Date.parse("2026-09-11T20:00:00.000Z");
    const store = new MemoryTasteStore({ now: () => new Date((tick += 1000)) });
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    const model = textModel("new notes");

    expect((await rewriteMemory({ store, graph, model }, "u1"))!.markdown).toContain("new notes");
    expect(model.doGenerateCalls).toHaveLength(1);

    // Same rows, nothing said since: the second request of a double-fire does
    // nothing at all.
    expect(await rewriteMemory({ store, graph, model }, "u1")).toBeNull();
    expect(model.doGenerateCalls).toHaveLength(1);

    // Something said in chat is new evidence: the rewrite runs again.
    await store.addEpisodes("u1", [{ kind: "chat", text: "i love a slow burn" }]);
    expect((await rewriteMemory({ store, graph, model }, "u1"))!.markdown).toContain("new notes");
    expect(model.doGenerateCalls).toHaveLength(2);

    // A `log` episode is not evidence any more — the row already said it.
    await store.addEpisodes("u1", [{ kind: "log", titleImdbId: APOLLO, text: "rated Apollo 13 (1995) 8/10" }]);
    expect(await rewriteMemory({ store, graph, model }, "u1")).toBeNull();
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

  it("after the turn: no extraction call, one rewrite from the rows", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    const model = scriptedModel([{ text: "nice." }]);
    // v5.2: the side model is called exactly once, for the rewrite. A chat turn
    // that logs nothing writes no episode at all.
    const side = textModel("## What you love\n- space procedurals");
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

    expect(await store.listEpisodes("u1")).toEqual([]);
    expect((await store.getMemory("u1"))?.markdown).toContain("space procedurals");
    expect(side.doGenerateCalls).toHaveLength(1);
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

  it("remember writes one titleless chat episode", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    const model = scriptedModel([{ tool: "remember", input: { text: "i love a slow burn" } }, { text: "noted." }]);
    await collect(
      runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("i love a slow burn")], followups: false, userId: "u1", taste: store, memory: false }),
    );
    expect((await store.listEpisodes("u1")).map((e) => ({ kind: e.kind, titleImdbId: e.titleImdbId, text: e.text }))).toEqual([
      { kind: "chat", titleImdbId: null, text: "i love a slow burn" },
    ]);
  });

  it("logging the same title again with no note keeps the note", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    const first = scriptedModel([{ tool: "log", input: { imdbId: GUMP, score: 9, note: "still cries at the bench" } }, { text: "noted." }]);
    const again = scriptedModel([{ tool: "log", input: { imdbId: GUMP, score: 8 } }, { text: "updated." }]);
    const run = (model: ReturnType<typeof scriptedModel>, text: string) =>
      collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage(text)], followups: false, userId: "u1", taste: store, memory: false }));
    await run(first, "i loved forrest gump");
    await run(again, "make that an 8");
    expect((await store.listEpisodes("u1"))[0].text).toBe('rated Forrest Gump (1994) 8/10: "still cries at the bench"');
  });
});

describe("rewrite from the rows", () => {
  it("builds the prompt from the rows and reports what the log no longer holds", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    // The log holds Apollo 13 only; the prose still names Forrest Gump.
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    await store.addEpisodes("u1", [{ kind: "log", titleImdbId: APOLLO, text: 'rated Apollo 13 (1995) 8/10: "the countdown"' }]);
    await store.setMemory("u1", { markdown: "## What you love\n**Apollo 13** at 8, and **Forrest Gump** was a 9." });

    const model = textModel("## What you love\n**Apollo 13** at 8.");
    const result = (await rewriteMemory({ store, graph, model }, "u1"))!;
    expect(result.dropped).toEqual(["Forrest Gump"]);
    expect(result.markdown).not.toContain("Forrest Gump");
    expect((await store.getMemory("u1"))!.dropped).toEqual(["Forrest Gump"]);

    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    // The row line carries the score, the kind, the note and the source.
    expect(prompt).toContain("Apollo 13 (1995)");
    expect(prompt).toContain("8/10");
    expect(prompt).toContain("the countdown");
    // The `log` episode itself is not evidence any more: the row says it.
    expect(prompt).not.toContain("[log]");
  });

  it("a re-rated row puts its new score in the prompt", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 4, source: "log" }]);
    const model = textModel("## What you avoid\n**Apollo 13** was a 4.");
    await rewriteMemory({ store, graph, model }, "u1");
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 9.7, source: "chat" }]);
    await rewriteMemory({ store, graph, model }, "u1");
    const prompt = JSON.stringify(model.doGenerateCalls[1].prompt);
    expect(prompt).toContain("9.7/10");
    expect(prompt).not.toContain("4/10");
  });

  it("unchanged rows with nothing said is a no-op", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "log" }]);
    const model = textModel("## What you love\n**Apollo 13**.");
    expect(await rewriteMemory({ store, graph, model }, "u1")).not.toBeNull();
    expect(model.doGenerateCalls).toHaveLength(1);

    // Same rows, nothing said: no second call.
    expect(await rewriteMemory({ store, graph, model }, "u1")).toBeNull();
    expect(model.doGenerateCalls).toHaveLength(1);

    // A deleted row changes the rendering, so the rewrite runs again.
    await store.deleteWatched("u1", APOLLO);
    await store.upsertWatched("u1", [{ titleImdbId: GUMP, rating: "rated", score: 9, source: "log" }]);
    expect(await rewriteMemory({ store, graph, model }, "u1")).not.toBeNull();
    expect(model.doGenerateCalls).toHaveLength(2);
  });
});
