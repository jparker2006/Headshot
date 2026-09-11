import { describe, it, expect } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { MemoryBrain } from "@/lib/brain";
import { pickPageSubjects, writePagesForTurn } from "@/lib/agent/pages";
import type { CanvasNode } from "@/lib/agent/events";

const node = (imdbId: string, name: string, kind: "person" | "title" = "person"): CanvasNode => ({
  imdbId, name, kind, titleType: kind === "title" ? "movie" : "", year: 0, votes: 0, genres: "", inIndustryGraph: true,
});

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };

describe("automatic pages", () => {
  it("picks entities the answer is about, endpoints first, deduped", () => {
    const touched = [node("nm1", "Ayo Edebiri"), node("tt1", "After the Hunt", "title"), node("nm2", "Julia Roberts"), node("nm3", "Nobody Mentioned"), node("nm1", "Ayo Edebiri")];
    const answer = "Ayo Edebiri and Julia Roberts share After the Hunt. Ayo Edebiri came from The Bear.";
    expect(pickPageSubjects(touched, answer).map((n) => n.name)).toEqual(["Ayo Edebiri", "Julia Roberts", "After the Hunt"]);
  });

  it("writes pages with the question as provenance and revises rather than duplicates", async () => {
    const brain = new MemoryBrain();
    await brain.touchNodes([{ ...node("nm1", "Ayo Edebiri"), }]);
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: `Ayo Edebiri is an actor known for The Bear. Draft ${++calls}.` }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      }),
    });
    const touched = [node("nm1", "Ayo Edebiri")];
    const answer = "Ayo Edebiri came from The Bear.";
    const first = await writePagesForTurn({ model, brain, question: "Who is Ayo Edebiri?", answer, touched });
    expect(first).toEqual(["nm1"]);
    const second = await writePagesForTurn({ model, brain, question: "What else has Ayo Edebiri done?", answer, touched });
    expect(second).toEqual(["nm1"]);
    const page = await brain.readPage("nm1");
    expect(page?.revisions.map((r) => r.question)).toEqual(["Who is Ayo Edebiri?", "What else has Ayo Edebiri done?"]);
    expect(page?.body).toContain("Draft 2");
    // The second prompt carried the existing page for merging.
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain("Existing page:\\nAyo Edebiri is an actor");
  });

  it("swallows model failures", async () => {
    const brain = new MemoryBrain();
    const model = new MockLanguageModelV4({ doGenerate: async () => { throw new Error("boom"); } });
    await expect(writePagesForTurn({ model, brain, question: "q", answer: "Ayo Edebiri", touched: [node("nm1", "Ayo Edebiri")] })).resolves.toEqual([]);
  });
});
