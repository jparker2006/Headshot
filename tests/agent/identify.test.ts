import { describe, it, expect } from "vitest";
import { runAgent } from "@/lib/agent";
import { MemoryBrain } from "@/lib/brain";
import { MAX_CHOICES, TIE_EPSILON, findByConstraints, hintTokens, selectMatches, type Candidate } from "@/lib/agent/identify";
import { collect, fixtureGraph, identifyGraph, ofType, scriptedModel, userMessage } from "./helpers";

const APOLLO = "tt0000001";
const GUMP = "tt0000002";
const FLEABAG = "tt0100001";
const SCOTT = "nm0100001";

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

describe("one answer, not eight (Jake, 2026-09-12)", () => {
  const hint = async (roleHint: string) => {
    const graph = await identifyGraph();
    const { candidates, total } = findByConstraints(graph, { titleIds: [graph.idOf(FLEABAG)!], roleHint });
    return { ...selectMatches(candidates), total, candidates };
  };

  it("a character-name match beats prominence: the priest is one person", async () => {
    const r = await hint("the priest");
    expect(r.mode).toBe("answer");
    expect(r.matches.map((m) => m.node.name)).toEqual(["Andrew Scott"]);
    expect(r.matches[0].credits[0].character).toBe("The Priest");
    // The top of the bill is more prominent and still loses by a mile.
    const runnerUp = r.candidates.find((c) => c.node.name === "Phoebe Waller-Bridge")!;
    expect(runnerUp.node.votes).toBeGreaterThan(r.matches[0].node.votes);
    expect(r.matches[0].score - runnerUp.score).toBeGreaterThan(TIE_EPSILON);
    expect(r.total).toBe(6);
  });

  it("a hint that fits two characters returns exactly those two", async () => {
    const r = await hint("the manager");
    expect(r.mode).toBe("choose");
    expect(r.matches.map((m) => m.node.name).sort()).toEqual(["Alex Rowe", "Hugh Dennis"]);
    expect(r.matches.every((m) => m.hintMatch > 0)).toBe(true);
  });

  it("a hint that matches nothing falls back to prominence and asks about at most four", async () => {
    const r = await hint("the bald guy");
    expect(r.mode).toBe("choose");
    expect(r.matches).toHaveLength(MAX_CHOICES);
    expect(r.matches.every((m) => m.hintMatch === 0)).toBe(true);
    expect(r.total).toBe(6);
    // The four shown really are near-tied; the cast is not.
    expect(r.matches[0].score - r.matches.at(-1)!.score).toBeLessThanOrEqual(TIE_EPSILON);
  });

  it("selectMatches ties on a numeric threshold, not on rank", () => {
    const c = (name: string, score: number) => ({ node: { name }, credits: [], score, hintMatch: 0, reasons: [] } as unknown as Candidate);
    expect(selectMatches([c("a", 5), c("b", 5 - TIE_EPSILON - 0.01)])).toMatchObject({ mode: "answer", matches: [{ node: { name: "a" } }] });
    expect(selectMatches([c("a", 5), c("b", 5 - TIE_EPSILON)]).mode).toBe("choose");
    expect(selectMatches([]).matches).toEqual([]);
    expect(selectMatches([c("only", 1)]).mode).toBe("answer");
  });
});

describe("identification through the agent, Fleabag", () => {
  it("\"who played the priest in Fleabag\" emits one face in answer mode and the model names them", async () => {
    const graph = await identifyGraph();
    const model = scriptedModel([{ text: "that's **Andrew Scott** — the priest." }]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("Who played the priest in Fleabag?")], followups: false }));
    const faces = ofType(chunks, "data-faces");
    expect(faces).toHaveLength(1);
    const data = faces[0].data;
    expect(data.mode).toBe("answer");
    expect(data.candidates.map((c) => c.imdbId)).toEqual([SCOTT]);
    expect(data.candidates[0].character).toBe("The Priest");
    expect(data.total).toBe(6);
    // The fast path ran the solver, and the model got one name, not the cast.
    expect(ofType(chunks, "data-fast")[0].data).toMatchObject({ shape: "identify", imdbIds: [FLEABAG] });
    const system = String(model.doStreamCalls[0].prompt.find((m) => m.role === "system")?.content);
    expect(system).toContain("Andrew Scott");
    expect(system).not.toContain("Sian Clifford");
    expect(system).toContain('"mode":"answer"');
    const text = ofType(chunks, "text-delta").map((c) => c.delta).join("");
    expect(text).toContain("Andrew Scott");
    // Only the one person is touched into the brain.
    const people = ofType(chunks, "data-node").map((n) => n.data).filter((n) => n.kind === "person");
    expect(people.map((p) => p.imdbId)).toEqual([SCOTT]);
  });

  it("a vague hint asks about the few it fits, never the cast", async () => {
    const graph = await identifyGraph();
    const model = scriptedModel([{ tool: "find_by_constraints", input: { titles: [FLEABAG], roleHint: "the manager" } }, { text: "two managers in it — which one?" }]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("who is the manager guy in Fleabag")], followups: false }));
    const data = ofType(chunks, "data-faces")[0].data;
    expect(data.mode).toBe("choose");
    expect(data.candidates).toHaveLength(2);
    expect(data.total).toBe(6);
    const out = ofType(chunks, "tool-output-available")[0].output as { mode: string; candidates: string[]; faceGridShown: boolean };
    expect(out.mode).toBe("choose");
    expect(out.candidates).toHaveLength(2);
    expect(out.faceGridShown).toBe(true);
  });
});
