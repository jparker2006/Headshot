import { describe, it, expect } from "vitest";
import { runAgent } from "@/lib/agent";
import { MemoryBrain } from "@/lib/brain";
import { findByConstraints, hintTokens } from "@/lib/agent/identify";
import { collect, fixtureGraph, ofType, scriptedModel, userMessage } from "./helpers";

const APOLLO = "tt0000001";
const GUMP = "tt0000002";

describe("find_by_constraints (engine seam)", () => {
  it("intersects casts across titles and ranks by prominence", async () => {
    const graph = await fixtureGraph();
    const both = findByConstraints(graph, { titleIds: [graph.idOf(APOLLO)!, graph.idOf(GUMP)!] });
    // Tom Hanks and Gary Sinise are in both fixture films.
    expect(both.candidates.map((c) => c.node.name)).toEqual(expect.arrayContaining(["Tom Hanks", "Gary Sinise"]));
    expect(both.candidates.every((c) => c.credits.length === 2)).toBe(true);
    const one = findByConstraints(graph, { titleIds: [graph.idOf(APOLLO)!] });
    expect(one.total).toBeGreaterThanOrEqual(both.total);
    expect(one.candidates[0].node.votes).toBeGreaterThanOrEqual(one.candidates.at(-1)!.node.votes);
  });

  it("strips filler from role hints", () => {
    expect(hintTokens("the bald guy who played the villain")).toEqual(["bald", "villain"]);
    expect(hintTokens(undefined)).toEqual([]);
  });

  it("filters by era and ignores non-title ids", async () => {
    const graph = await fixtureGraph();
    const r = findByConstraints(graph, { titleIds: [graph.idOf(APOLLO)!, graph.idOf("nm0000001")!], era: { from: 1950, to: 1960 } });
    expect(r.total).toBeGreaterThan(0);
    for (const c of r.candidates) if (c.node.year) expect(c.reasons.join()).toContain(c.node.year >= 1950 && c.node.year <= 1960 ? "born" : "");
    expect(findByConstraints(graph, { titleIds: [graph.idOf("nm0000001")!] }).total).toBe(0);
  });
});

describe("identification through the agent", () => {
  it("the tool emits a face grid when several people fit, and a tap-to-open rule applies when the text is empty", async () => {
    const graph = await fixtureGraph();
    const model = scriptedModel([{ tool: "find_by_constraints", input: { titles: [APOLLO], roleHint: "the guy" } }, { text: "" }]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("that guy, Apollo 13, you know the one")], followups: false }));
    const faces = ofType(chunks, "data-faces");
    expect(faces).toHaveLength(1);
    const data = faces[0].data as { candidates: { imdbId: string; name: string; credit: string }[]; total: number };
    expect(data.candidates.length).toBeGreaterThanOrEqual(2);
    expect(data.candidates.length).toBeLessThanOrEqual(8);
    expect(data.candidates[0].credit).toContain("Apollo 13");
    const out = ofType(chunks, "tool-output-available")[0].output as { faceGridShown: boolean };
    expect(out.faceGridShown).toBe(true);
    expect(ofType(chunks, "data-node").map((n) => (n.data as { imdbId: string }).imdbId)).toContain(APOLLO);
  });

  it("the identify fast path runs the solver before the model", async () => {
    const graph = await fixtureGraph();
    const model = scriptedModel([{ text: "Probably **Tom Hanks**." }]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("Who played the astronaut in Apollo 13?")], followups: false }));
    expect(ofType(chunks, "data-fast")[0].data).toMatchObject({ shape: "identify", imdbIds: [APOLLO] });
    const system = String(model.doStreamCalls[0].prompt.find((m) => m.role === "system")?.content);
    expect(system).toContain("find_by_constraints");
    expect(system).toContain('"roleHint":"astronaut"');
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it("reports an unknown title instead of throwing", async () => {
    const graph = await fixtureGraph();
    const model = scriptedModel([{ tool: "find_by_constraints", input: { titles: ["tt9999999"], roleHint: "x" } }, { text: "?" }]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("q")], followups: false }));
    expect(ofType(chunks, "tool-output-available")[0].output).toMatchObject({ error: "unknown_title" });
  });
});
