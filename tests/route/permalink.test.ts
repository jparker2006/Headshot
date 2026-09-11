import { describe, it, expect } from "vitest";
import { MemoryBrain } from "@/lib/brain";
import { loadAnswerPage, parsePermalink, permalinkPath, followupHref } from "@/lib/answers/permalink";
import { ogImageFor } from "@/lib/answers/og";
import { fixtureGraph } from "../agent/helpers";

const BACON = "nm0000001";
const SINISE = "nm0000004";

function stored(overrides: Partial<Parameters<MemoryBrain["saveAnswer"]>[0]> = {}) {
  return {
    id: "ab2cd3",
    slug: "kevin-bacon-to-gary-sinise",
    shape: "path",
    entityIds: [BACON, SINISE],
    cacheKey: `path:${BACON},${SINISE}`,
    question: "How is Kevin Bacon connected to Gary Sinise?",
    chosenPath: [BACON, "tt0000001", SINISE],
    summary: null,
    narration: "**Kevin Bacon** and **Gary Sinise** were both in **Apollo 13**.",
    followups: ["Who else was in Apollo 13?", "How is Tom Hanks connected to Kevin Bacon?"],
    events: [],
    graphBuildId: "test",
    sessionId: "s1",
    public: true,
    ...overrides,
  };
}

describe("permalinks (route seam)", () => {
  it("parses <slug>-<shortid> and rejects junk", () => {
    expect(parsePermalink("heath-ledger-to-natalie-portman-7f3k2q")).toEqual({ slug: "heath-ledger-to-natalie-portman", id: "7f3k2q" });
    expect(parsePermalink("nope")).toBeNull();
    expect(parsePermalink("slug-ABCDEF")).toBeNull();
    expect(parsePermalink("../etc-7f3k2q")).toBeNull();
    expect(permalinkPath({ slug: "a-to-b", id: "7f3k2q" })).toBe("/a/a-to-b-7f3k2q");
  });

  it("renders a stored public answer: chain with names, degrees, ego of the first person, follow-up links", async () => {
    const graph = await fixtureGraph();
    const brain = new MemoryBrain();
    await brain.saveAnswer(stored());
    // A follow-up that already has a public answer links to its permalink.
    await brain.saveAnswer(stored({ id: "zz9zz9", slug: "tom-hanks-to-kevin-bacon", cacheKey: `path:${BACON},nm0000002`, entityIds: [BACON, "nm0000002"], question: "How is Tom Hanks connected to Kevin Bacon?" }));

    const page = await loadAnswerPage({ brain, graph, tmdb: null, origin: "https://headshot.test" }, "kevin-bacon-to-gary-sinise-ab2cd3");
    expect(page).not.toBeNull();
    expect(page!.title).toBe("Kevin Bacon to Gary Sinise");
    expect(page!.chain.map((c) => c.name)).toEqual(["Kevin Bacon", "Apollo 13", "Gary Sinise"]);
    expect(page!.chain.map((c) => c.kind)).toEqual(["person", "title", "person"]);
    expect(page!.degrees).toBe(1);
    expect(page!.firstPerson?.imdbId).toBe(BACON);
    expect(page!.ego?.center).toBe(BACON);
    expect(page!.ego?.nodes.some((n) => n.ring === 1)).toBe(true);
    expect(page!.url).toBe("https://headshot.test/a/kevin-bacon-to-gary-sinise-ab2cd3");
    expect(page!.followups).toEqual([
      { text: "Who else was in Apollo 13?", href: `/?q=${encodeURIComponent("Who else was in Apollo 13?")}` },
      { text: "How is Tom Hanks connected to Kevin Bacon?", href: "/a/tom-hanks-to-kevin-bacon-zz9zz9" },
    ]);
  });

  it("does not serve private or missing answers", async () => {
    const graph = await fixtureGraph();
    const brain = new MemoryBrain();
    await brain.saveAnswer(stored({ public: false }));
    expect(await loadAnswerPage({ brain, graph, tmdb: null }, "kevin-bacon-to-gary-sinise-ab2cd3")).toBeNull();
    expect(await loadAnswerPage({ brain, graph, tmdb: null }, "kevin-bacon-to-gary-sinise-qqqqqq")).toBeNull();
    expect(await followupHref({ brain, graph }, "How is Kevin Bacon connected to Gary Sinise?")).toBe(`/?q=${encodeURIComponent("How is Kevin Bacon connected to Gary Sinise?")}`);
  });

  it("returns a PNG Open Graph image for a stored answer", async () => {
    const graph = await fixtureGraph();
    const brain = new MemoryBrain();
    await brain.saveAnswer(stored());
    const page = (await loadAnswerPage({ brain, graph, tmdb: null }, "kevin-bacon-to-gary-sinise-ab2cd3"))!;
    const res = ogImageFor(page);
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(1000);
    // PNG signature
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }, 30_000);
});
