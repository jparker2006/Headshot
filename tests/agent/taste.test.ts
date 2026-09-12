import { describe, it, expect } from "vitest";
import { runAgent } from "@/lib/agent";
import { MemoryBrain } from "@/lib/brain";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { formatTasteContext, tasteSummary } from "@/lib/agent/tasteContext";
import { collect, fixtureGraph, ofType, scriptedModel, userMessage } from "./helpers";

const APOLLO = "tt0000001";
const GUMP = "tt0000002";
const GOOD_SERIES = "tt0000009";

describe("taste in the chat", () => {
  it("builds the about-this-user block from explicit ratings only", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    expect(await tasteSummary(graph, store, "u1")).toBeNull();
    await store.setServices("u1", { providerIds: [8, 15] });
    await store.upsertWatched("u1", [
      { titleImdbId: APOLLO, rating: "rated", score: 8, source: "letterboxd" },
      { titleImdbId: GUMP, rating: "rated", score: 8, source: "swipe" },
      { titleImdbId: GOOD_SERIES, rating: "rated", score: 8, source: "chat", season: 2, episodesWatched: 3 },
      { titleImdbId: "tt0000006", rating: "want", source: "swipe" },
    ]);
    const t = (await tasteSummary(graph, store, "u1"))!;
    expect(t.counts).toEqual({ liked: 3, meh: 0, want: 1, unseen: 0 });
    expect(t.services).toEqual(["Netflix", "Hulu"]);
    expect(t.people.map((p) => p.name)).toContain("Tom Hanks");
    expect(t.later.map((l) => l.name)).toEqual(["Mini Series"]);
    expect(t.watching).toEqual([{ name: "Good Series", season: 2, episodesWatched: 3 }]);
    const block = formatTasteContext(t);
    expect(block).toContain("Pays for: Netflix, Hulu");
    expect(block).toContain("Tom Hanks");
    expect(block).toContain("Later list: Mini Series");
  });

  it("the model sees the block when signed in, and log writes a chat-sourced row", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "swipe" }]);
    const model = scriptedModel([{ tool: "log", input: { imdbId: GUMP, score: 8 } }, { text: "noted, **Forrest Gump** at an 8." }]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("i loved forrest gump")], followups: false, userId: "u1", taste: store }));
    const system = String(model.doStreamCalls[0].prompt.find((m) => m.role === "system")?.content);
    expect(system).toContain("This user is signed in");
    expect(system).toContain("Apollo 13");
    expect(ofType(chunks, "tool-output-available")[0].output).toMatchObject({ ok: true, state: "rated", score: 8 });
    expect((await store.listWatched("u1")).find((r) => r.titleImdbId === GUMP)).toMatchObject({ rating: "rated", score: 8, source: "chat" });
  });

  it("signed out: no taste block and no taste tools", async () => {
    const graph = await fixtureGraph();
    const model = scriptedModel([{ tool: "my_taste", input: {} }, { text: "?" }]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("what do i like")], followups: false }));
    const system = String(model.doStreamCalls[0].prompt.find((m) => m.role === "system")?.content);
    expect(system).not.toContain("This user is signed in");
    // The tool does not exist for a signed-out request: the SDK reports the call as an error rather than running it.
    expect(ofType(chunks, "tool-output-available")).toHaveLength(0);
  });

  it("tonight_picks returns the stored picks with reasons", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.setServices("u1", { providerIds: [15] });
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "swipe" }]);
    const model = scriptedModel([{ tool: "tonight_picks", input: {} }, { text: "ok" }]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("what should i watch")], followups: false, userId: "u1", taste: store }));
    const out = ofType(chunks, "tool-output-available")[0].output as { picks: { title: string; reason: string }[] };
    expect(out.picks.length).toBeGreaterThan(0);
    expect(out.picks.some((p) => p.title.startsWith("Forrest Gump"))).toBe(true);
    expect(out.picks[0].reason.length).toBeGreaterThan(0);
  });
});
