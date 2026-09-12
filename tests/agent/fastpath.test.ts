import { describe, it, expect } from "vitest";
import { runAgent } from "@/lib/agent";
import { MemoryBrain } from "@/lib/brain";
import { classify, matchShape } from "@/lib/agent/fastpath";
import { answerSlug, cacheKey, isPublicSafe, slugify } from "@/lib/agent/answers";
import { collect, fixtureGraph, ofType, scriptedModel, userMessage, type Chunk } from "./helpers";

const BACON = "nm0000001";
const SINISE = "nm0000004";
const HANKS = "nm0000002";

describe("fast path classifier", () => {
  it("assigns shapes from question text", () => {
    expect(matchShape("How is Kevin Bacon connected to Gary Sinise?")).toMatchObject({ shape: "path", names: ["Kevin Bacon", "Gary Sinise"] });
    expect(matchShape("connect Zendaya to Al Pacino")).toMatchObject({ shape: "path", names: ["Zendaya", "Al Pacino"] });
    expect(matchShape("Kevin Bacon → Tom Hanks")).toMatchObject({ shape: "path" });
    expect(matchShape("Have Tom Hanks and Gary Sinise worked together?")).toMatchObject({ shape: "costar", names: ["Tom Hanks", "Gary Sinise"] });
    expect(matchShape("Did Tom Hanks and Bill Paxton ever work together")).toMatchObject({ shape: "costar" });
    expect(matchShape("Who was in both Apollo 13 and Forrest Gump?")).toMatchObject({ shape: "both", names: ["Apollo 13", "Forrest Gump"] });
    expect(matchShape("What is Tom Hanks best known for?")).toMatchObject({ shape: "known-for", names: ["Tom Hanks"] });
    expect(matchShape("What else has Bill Paxton been in?")).toMatchObject({ shape: "known-for", names: ["Bill Paxton"] });
    expect(matchShape("Who played the astronaut in Apollo 13?")).toMatchObject({ shape: "identify", names: ["astronaut", "Apollo 13"] });
    expect(matchShape("The bald guy from the Apple show who was also in Parks and Rec")).toBeNull();
    expect(matchShape("Tell me something interesting about Tom Hanks")).toBeNull();
  });

  it("resolves entities exactly and refuses unknown or ambiguous names", async () => {
    const graph = await fixtureGraph();
    const c = classify(graph, "How is Kevin Bacon connected to Gary Sinise?");
    expect(c?.shape).toBe("path");
    expect(c?.entities.map((e) => e.imdbId)).toEqual([BACON, SINISE]);
    expect(classify(graph, "connect kevin bacon to gary sinise")?.entities.map((e) => e.imdbId)).toEqual([BACON, SINISE]);
    // Unknown name: the agent handles it.
    expect(classify(graph, "How is Kevin Bacon connected to Nobody Famous?")).toBeNull();
    // Title where a person is expected: not this shape.
    expect(classify(graph, "connect Apollo 13 to Kevin Bacon")).toBeNull();
    // Same entity twice is not a path question.
    expect(classify(graph, "connect Kevin Bacon to Kevin Bacon")).toBeNull();
    const both = classify(graph, "Who was in both Apollo 13 and Forrest Gump?");
    expect(both?.shape).toBe("both");
    expect(both?.entities.map((e) => e.imdbId)).toEqual(["tt0000001", "tt0000002"]);
  });
});

describe("answer helpers", () => {
  it("keys by shape and sorted ids, never text", () => {
    expect(cacheKey("path", [SINISE, BACON])).toBe(`path:${BACON},${SINISE}`);
    expect(cacheKey("path", [BACON, SINISE])).toBe(cacheKey("path", [SINISE, BACON]));
  });
  it("makes readable slugs and gates public permalinks", () => {
    expect(slugify("Timothée Chalamet")).toBe("timothee-chalamet");
    expect(answerSlug("path", ["Heath Ledger", "Natalie Portman"])).toBe("heath-ledger-to-natalie-portman");
    expect(isPublicSafe("How is Kevin Bacon connected to Gary Sinise?")).toBe(true);
    expect(isPublicSafe("who the fuck is Kevin Bacon")).toBe(false);
    expect(isPublicSafe("a".repeat(200))).toBe(false);
  });
});

function indexOf(chunks: Chunk[], type: Chunk["type"]) {
  return chunks.findIndex((c) => c.type === type);
}

describe("fast path in the agent loop", () => {
  it("streams the chain before any model call and the model narrates without calling the graph", async () => {
    const graph = await fixtureGraph();
    const brain = new MemoryBrain();
    const model = scriptedModel([{ text: "**Kevin Bacon** and **Gary Sinise** were both in **Apollo 13**." }]);
    const chunks = await collect(runAgent({ model, graph, brain, tmdb: null, messages: [userMessage("How is Kevin Bacon connected to Gary Sinise?")], sessionId: "s1", followups: false }));

    expect(model.doStreamCalls).toHaveLength(1);
    const system = String(model.doStreamCalls[0].prompt.find((m) => m.role === "system")?.content ?? "");
    expect(system).toContain("Precomputed for this question");
    expect(system).toContain("shortest_path(nm0000001, nm0000004) has already been run");

    // Chain events precede the model's text.
    expect(ofType(chunks, "data-fast")[0].data).toMatchObject({ shape: "path", imdbIds: [BACON, SINISE], cached: false });
    expect(indexOf(chunks, "data-paths")).toBeGreaterThan(-1);
    expect(indexOf(chunks, "data-paths")).toBeLessThan(indexOf(chunks, "text-start"));
    expect(indexOf(chunks, "data-chosen")).toBeLessThan(indexOf(chunks, "text-start"));
    expect(ofType(chunks, "data-path-hop")).toHaveLength(2);
    expect(ofType(chunks, "tool-input-available")).toHaveLength(0);

    // Stored for next time, and announced.
    const answerEvt = ofType(chunks, "data-answer")[0].data as { id: string; slug: string; public: boolean };
    expect(answerEvt.slug).toBe("kevin-bacon-to-gary-sinise");
    expect(answerEvt.public).toBe(true);
    const stored = await brain.getAnswer(`path:${BACON},${SINISE}`);
    expect(stored?.narration).toContain("Apollo 13");
    expect(stored?.chosenPath).toEqual([BACON, "tt0000001", SINISE]);
    expect(stored?.events.map((e) => e.type)).toEqual(expect.arrayContaining(["node", "edge", "paths", "chosen", "path-hop", "focus"]));
    expect(stored?.graphBuildId).toBe(graph.buildId);
  });

  it("replays a stored answer without calling the model, in either name order", async () => {
    const graph = await fixtureGraph();
    const brain = new MemoryBrain();
    const first = scriptedModel([{ text: "One hop via **Apollo 13**." }]);
    await collect(runAgent({ model: first, graph, brain, tmdb: null, messages: [userMessage("How is Kevin Bacon connected to Gary Sinise?")], sessionId: "s1", followups: false }));

    const second = scriptedModel([{ text: "should not be called" }]);
    const chunks = await collect(runAgent({ model: second, graph, brain, tmdb: null, messages: [userMessage("connect Gary Sinise to Kevin Bacon")], sessionId: "s2", followups: false }));
    expect(second.doStreamCalls).toHaveLength(0);
    expect(ofType(chunks, "data-fast")[0].data).toMatchObject({ cached: true, stale: false });
    expect(ofType(chunks, "data-paths")).toHaveLength(1);
    expect(ofType(chunks, "data-path-hop")).toHaveLength(2);
    expect(ofType(chunks, "text-delta").map((t) => t.delta).join("")).toBe("One hop via **Apollo 13**.");
    expect(ofType(chunks, "data-answer")).toHaveLength(1);
    expect(chunks.at(-1)?.type).toBe("finish");
    // The second session still gets credit for the nodes it saw.
    expect(await brain.sessionNodes("s1")).toContain(BACON);
  });

  it("serves a stale answer and recomputes it in the background", async () => {
    const graph = await fixtureGraph();
    const brain = new MemoryBrain();
    await brain.saveAnswer({
      id: "old001",
      slug: "kevin-bacon-to-gary-sinise",
      shape: "path",
      entityIds: [BACON, SINISE],
      cacheKey: `path:${BACON},${SINISE}`,
      question: "How is Kevin Bacon connected to Gary Sinise?",
      chosenPath: [BACON, "tt0000001", SINISE],
      summary: null,
      narration: "Old narration.",
      followups: [],
      events: [],
      graphBuildId: "previous-build",
      sessionId: null,
      public: true,
    });
    const model = scriptedModel([{ text: "Fresh narration." }]);
    const scheduled: (() => Promise<void>)[] = [];
    const chunks = await collect(
      runAgent({ model, graph, brain, tmdb: null, messages: [userMessage("How is Kevin Bacon connected to Gary Sinise?")], followups: false, schedule: (w) => void scheduled.push(w) }),
    );
    expect(ofType(chunks, "text-delta").map((t) => t.delta).join("")).toBe("Old narration.");
    expect(ofType(chunks, "data-fast")[0].data).toMatchObject({ cached: true, stale: true });
    expect(model.doStreamCalls).toHaveLength(0);
    expect(scheduled).toHaveLength(1);
    await scheduled[0]();
    const fresh = await brain.getAnswer(`path:${BACON},${SINISE}`);
    expect(fresh?.narration).toBe("Fresh narration.");
    expect(fresh?.graphBuildId).toBe(graph.buildId);
    expect(fresh?.id).not.toBe("old001");
  });

  it("falls through to the agent when a name does not resolve", async () => {
    const graph = await fixtureGraph();
    const model = scriptedModel([{ tool: "find_entities", input: { query: "Nobody" } }, { text: "Could not find them." }]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("How is Kevin Bacon connected to Nobody Famous?")], followups: false }));
    expect(ofType(chunks, "data-fast")).toHaveLength(0);
    expect(model.doStreamCalls).toHaveLength(2);
    expect(ofType(chunks, "data-answer")).toHaveLength(0);
  });

  it("precomputes costar and both shapes too", async () => {
    const graph = await fixtureGraph();
    const brain = new MemoryBrain();
    const m1 = scriptedModel([{ text: "Yes." }]);
    const c1 = await collect(runAgent({ model: m1, graph, brain, tmdb: null, messages: [userMessage("Have Tom Hanks and Gary Sinise worked together?")], followups: false }));
    expect(String(m1.doStreamCalls[0].prompt.find((m) => m.role === "system")?.content)).toContain(`shared_credits(${HANKS}, ${SINISE})`);
    expect(ofType(c1, "data-edge").length).toBeGreaterThan(0);
    expect(await brain.getAnswer(`costar:${HANKS},${SINISE}`)).not.toBeNull();

    const m2 = scriptedModel([{ text: "Tom Hanks." }]);
    await collect(runAgent({ model: m2, graph, brain, tmdb: null, messages: [userMessage("Who was in both Apollo 13 and Forrest Gump?")], followups: false }));
    expect(String(m2.doStreamCalls[0].prompt.find((m) => m.role === "system")?.content)).toContain("common_neighbors(tt0000001, tt0000002)");
    expect(await brain.getAnswer("both:tt0000001,tt0000002")).not.toBeNull();
  });
});

