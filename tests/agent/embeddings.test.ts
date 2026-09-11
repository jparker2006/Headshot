import { describe, it, expect } from "vitest";
import { entityText, trimEmbedding } from "@/lib/agent/embeddings";
import { runAgent } from "@/lib/agent";
import { MemoryBrain } from "@/lib/brain";
import { collect, fixtureGraph, ofType, scriptedModel, userMessage } from "./helpers";

describe("embeddings", () => {
  it("truncates to the column width and re-normalizes", () => {
    const v = trimEmbedding(Array.from({ length: 1536 }, (_, i) => (i < 512 ? 1 : 100)), 512);
    expect(v).toHaveLength(512);
    expect(Math.sqrt(v.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1, 6);
    expect(trimEmbedding([3, 4], 4)).toEqual([0.6, 0.8, 0, 0]);
  });

  it("describes entities with their prominent credits", async () => {
    const graph = await fixtureGraph();
    const hanks = entityText(graph, graph.nodeByImdbId("nm0000002")!);
    expect(hanks).toContain("Tom Hanks");
    expect(hanks).toContain("Apollo 13 (1995)");
    const apollo = entityText(graph, graph.nodeByImdbId("tt0000001")!);
    expect(apollo).toMatch(/^Apollo 13 \(1995\)\. movie/);
    expect(apollo).toContain("Tom Hanks");
  });

  it("find_entities falls back to semantic search when no name matches", async () => {
    const graph = await fixtureGraph();
    const brain = new MemoryBrain();
    brain.semanticSearch = async () => [{ imdbId: "nm0000002", distance: 0.1 }, { imdbId: "tt0000001", distance: 0.2 }];
    const model = scriptedModel([{ tool: "find_entities", input: { query: "the guy who played the astronaut with the moustache", kind: "person" } }, { text: "ok" }]);
    const chunks = await collect(runAgent({ model, graph, brain, tmdb: null, messages: [userMessage("q")], followups: false, embed: async () => [1, 0, 0] }));
    const out = ofType(chunks, "tool-output-available")[0].output as { candidates: string[]; semantic?: boolean };
    expect(out.semantic).toBe(true);
    expect(out.candidates[0]).toContain("Tom Hanks");
    expect(out.candidates).toHaveLength(1); // the title was filtered out by kind
  });
});
