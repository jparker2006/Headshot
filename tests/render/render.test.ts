import { describe, it, expect } from "vitest";
import { MemoryBrain } from "@/lib/brain";
import { renderBrain } from "@/lib/brain/render";
import { fixtureGraph } from "../agent/helpers";

const BACON = "nm0000001";
const HANKS = "nm0000002";
const APOLLO = "tt0000001";
const GUMP = "tt0000002";

describe("renderBrain", () => {
  it("derives packed edges only between touched nodes and includes overlay edges", async () => {
    const graph = await fixtureGraph();
    const brain = new MemoryBrain();
    const touch = (imdbId: string, kind: "person" | "title", inIndustryGraph = true) => ({
      imdbId, name: imdbId, kind, titleType: "" as const, year: 0, votes: 0, genres: "", inIndustryGraph,
    });
    await brain.touchNodes([touch(BACON, "person"), touch(APOLLO, "title"), touch(HANKS, "person")], "s1");
    await brain.touchNodes([touch("nm0009999", "person", false)], "s2");
    await brain.addEdges([
      { personImdbId: "nm0009999", titleImdbId: APOLLO, tier: 1 },
      { personImdbId: "nm0009999", titleImdbId: GUMP, tier: 1 }, // Gump untouched → hidden
    ]);
    const r = await renderBrain(graph, brain, "s1");
    const keys = r.edges.map((e) => `${e.personImdbId}|${e.titleImdbId}|${e.source}`).sort();
    expect(keys).toEqual([`${BACON}|${APOLLO}|packed`, `${HANKS}|${APOLLO}|packed`, `nm0009999|${APOLLO}|overlay`]);
    expect(r.sessionNodeIds.sort()).toEqual([APOLLO, BACON, HANKS].sort());
    expect(r.nodes).toHaveLength(4);
    expect(r.buildId).toBe("test");
  });

  it("renders an empty brain", async () => {
    const r = await renderBrain(await fixtureGraph(), new MemoryBrain());
    expect(r).toMatchObject({ nodes: [], edges: [], sessionNodeIds: [] });
  });
});
