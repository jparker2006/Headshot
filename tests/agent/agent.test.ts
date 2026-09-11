import { describe, it, expect } from "vitest";
import { runAgent } from "@/lib/agent";
import { MemoryBrain } from "@/lib/brain";
import { collect, currentHops, fixtureGraph, ofType, scriptedModel, userMessage } from "./helpers";

const BACON = "nm0000001";
const SINISE = "nm0000004";
const JANE = "nm0000005";

describe("agent loop (mocked model seam)", () => {
  it("streams a deterministic Bacon number, path hops, and a page revision for a path question", async () => {
    const graph = await fixtureGraph();
    const brain = new MemoryBrain();
    const question = "How is Kevin Bacon connected to Gary Sinise?";
    const model = scriptedModel([
      { tool: "find_entities", input: { query: "Kevin Bacon", kind: "person" } },
      { tool: "shortest_path", input: { from: BACON, to: SINISE } },
      { tool: "highlight_path", input: { from: BACON, to: SINISE, tier: "full", index: 0, reason: "Only one path." } },
      { tool: "write_page", input: { imdbId: BACON, body: "Kevin Bacon is one hop from Gary Sinise via Apollo 13 (1995)." } },
      { text: "Kevin Bacon → Apollo 13 → Gary Sinise. Bacon number 1." },
    ]);

    const chunks = await collect(runAgent({ model, graph, brain, tmdb: null, messages: [userMessage(question)], sessionId: "s1" }));

    // Model was called once per scripted step and saw tool results between steps.
    expect(model.doStreamCalls).toHaveLength(5);
    const secondPrompt = JSON.stringify(model.doStreamCalls[1].prompt);
    expect(secondPrompt).toContain("Kevin Bacon [nm0000001");

    // Candidates were shown while resolving.
    const candidates = ofType(chunks, "data-candidates");
    expect(candidates).toHaveLength(1);
    expect((candidates[0].data as { candidates: { name: string }[] }).candidates[0].name).toBe("Kevin Bacon");

    // The paths event carries the engine's exact result.
    const paths = ofType(chunks, "data-paths");
    expect(paths).toHaveLength(1);
    const found = paths[0].data as { baconNumber: number; full: { paths: { names: string[] }[] }; differ: boolean };
    expect(found.baconNumber).toBe(1);
    expect(found.full.paths[0].names).toEqual(["Kevin Bacon", "Apollo 13", "Gary Sinise"]);
    expect(found.differ).toBe(false);

    // The tool output the model received is the same object, unmodified.
    const outputs = ofType(chunks, "tool-output-available");
    const pathOutput = outputs.find((o) => (o as { toolCallId: string }).toolCallId === "call-1")!;
    expect(pathOutput.output).toMatchObject(found);

    // shortest_path auto-lit the strong route, then highlight_path re-lit the full one; count the latest.
    expect(ofType(chunks, "data-chosen")).toHaveLength(2);
    const hops = currentHops(chunks).map((h) => h.data as { from: string; to: string; via: string | null; index: number; total: number });
    expect(hops.map((h) => h.index)).toEqual([0, 1]);
    expect(hops[0]).toMatchObject({ from: BACON, to: "tt0000001", via: "Apollo 13", total: 2 });
    expect(hops[1]).toMatchObject({ from: "tt0000001", to: SINISE, via: null });
    expect(ofType(chunks, "data-focus").at(-1)?.data).toEqual({ imdbIds: [BACON, "tt0000001", SINISE] });

    // Nodes and edges entered the brain and were announced.
    const nodeIds = ofType(chunks, "data-node").map((n) => (n.data as { imdbId: string }).imdbId);
    expect(nodeIds).toEqual(expect.arrayContaining([BACON, "tt0000001", SINISE]));
    expect(ofType(chunks, "data-edge").length).toBeGreaterThan(0);
    const snap = await brain.snapshot();
    expect(snap.nodes.map((n) => n.imdbId)).toEqual(expect.arrayContaining([BACON, "tt0000001", SINISE]));
    expect(await brain.sessionNodes("s1")).toEqual(expect.arrayContaining([BACON, SINISE]));

    // The page write logged the triggering question.
    const pageEvents = ofType(chunks, "data-page");
    expect(pageEvents[0].data).toEqual({ imdbId: BACON, question, revision: 1 });
    const page = await brain.readPage(BACON);
    expect(page?.revisions).toHaveLength(1);
    expect(page?.revisions[0].question).toBe(question);

    // Final narration streamed as text.
    const text = ofType(chunks, "text-delta").map((t) => t.delta).join("");
    expect(text).toContain("Bacon number 1");
  });

  it("reports strong-first tiering: interesting route vs true Bacon number", async () => {
    const graph = await fixtureGraph();
    const model = scriptedModel([
      { tool: "shortest_path", input: { from: JANE, to: BACON } },
      { tool: "highlight_path", input: { from: JANE, to: BACON, tier: "strong", index: 0, reason: "Real collaborations beat a talk show." } },
      { text: "Bacon number 1 via Late Night Show; the interesting route is 2." },
    ]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("Connect Jane Doe to Kevin Bacon")] }));
    const found = ofType(chunks, "data-paths")[0].data as {
      baconNumber: number;
      differ: boolean;
      strong: { baconNumber: number; paths: { names: string[] }[] };
      full: { baconNumber: number; paths: { names: string[] }[] };
    };
    expect(found.baconNumber).toBe(1);
    expect(found.full.paths[0].names).toEqual(["Jane Doe", "Late Night Show", "Kevin Bacon"]);
    expect(found.strong.baconNumber).toBe(2);
    expect(found.strong.paths[0].names).toEqual(["Jane Doe", "Good Series", "Bill Paxton", "Apollo 13", "Kevin Bacon"]);
    expect(found.differ).toBe(true);
    const hops = currentHops(chunks).map((h) => h.data as { tier: string; total: number });
    expect(hops).toHaveLength(4);
    expect(hops.every((h) => h.tier === "strong" && h.total === 4)).toBe(true);
  });

  it("surfaces tool errors to the model instead of crashing, and TMDB reports unavailable without a token", async () => {
    const graph = await fixtureGraph();
    const model = scriptedModel([
      { tool: "shortest_path", input: { from: "nm0009999", to: BACON } },
      { tool: "tmdb_search", input: { query: "Nobody" } },
      { text: "I could not find that person." },
    ]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("Connect nm0009999 to Bacon")] }));
    const errors = ofType(chunks, "tool-output-error");
    expect(errors).toHaveLength(1);
    expect(String(errors[0].errorText)).toContain("not in the graph");
    const tmdb = ofType(chunks, "tool-output-available").find((o) => (o as { toolCallId: string }).toolCallId === "call-1")!;
    expect(tmdb.output).toMatchObject({ error: "unavailable" });
    expect(ofType(chunks, "text-delta").map((t) => t.delta).join("")).toContain("could not find");
  });

  it("merges the brain overlay into path finding", async () => {
    const graph = await fixtureGraph();
    const brain = new MemoryBrain();
    await brain.touchNodes([{ imdbId: "nm0009999", name: "Newbie Actor", kind: "person", titleType: "", year: 0, votes: 0, genres: "", inIndustryGraph: false }]);
    await brain.addEdges([{ personImdbId: "nm0009999", titleImdbId: "tt0000001", tier: 1 }]);
    const model = scriptedModel([{ tool: "shortest_path", input: { from: "nm0009999", to: BACON } }, { text: "done" }]);
    const chunks = await collect(runAgent({ model, graph, brain, tmdb: null, messages: [userMessage("q")] }));
    const found = ofType(chunks, "data-paths")[0].data as { baconNumber: number; full: { paths: { names: string[] }[] } };
    expect(found.baconNumber).toBe(1);
    expect(found.full.paths[0].names).toEqual(["Newbie Actor", "Apollo 13", "Kevin Bacon"]);
  });

  it("refuses to write pages for unknown entities", async () => {
    const graph = await fixtureGraph();
    const brain = new MemoryBrain();
    const model = scriptedModel([{ tool: "write_page", input: { imdbId: "nm0001234", body: "This person does not exist in any graph." } }, { text: "ok" }]);
    const chunks = await collect(runAgent({ model, graph, brain, tmdb: null, messages: [userMessage("q")] }));
    expect(ofType(chunks, "tool-output-available")[0].output).toMatchObject({ error: "unknown_entity" });
    expect(await brain.readPage("nm0001234")).toBeNull();
  });
});
