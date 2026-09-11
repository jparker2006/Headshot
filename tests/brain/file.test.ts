import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MemoryBrain } from "@/lib/brain";

describe("MemoryBrain file persistence", () => {
  it("round-trips nodes, edges, pages, sessions, and questions through the JSON file", async () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "headshot-brain-")), "brain.json");
    const a = new MemoryBrain({ file });
    await a.touchNodes([{ imdbId: "nm1", name: "A", kind: "person", titleType: "", year: 0, votes: 0, genres: "", inIndustryGraph: false }], "s1");
    await a.addEdges([{ personImdbId: "nm1", titleImdbId: "tt1", tier: 1 }]);
    await a.writePage({ imdbId: "nm1", body: "A page body long enough.", question: "q?" });
    await a.recordQuestion({ sessionId: "s1", text: "q?" });
    a.flush();

    const b = new MemoryBrain({ file });
    expect((await b.snapshot()).nodes.map((n) => n.imdbId)).toEqual(["nm1"]);
    expect((await b.getOverlay()).edges).toEqual([{ personImdbId: "nm1", titleImdbId: "tt1", tier: 1 }]);
    expect((await b.readPage("nm1"))?.revisions[0].question).toBe("q?");
    expect(await b.sessionNodes("s1")).toEqual(["nm1"]);
    expect(await b.countQuestionsToday()).toBe(1);
  });
});
