import { describe, it, expect } from "vitest";
import { runAgent } from "@/lib/agent";
import { MemoryBrain } from "@/lib/brain";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { formatTasteContext, tasteSummary } from "@/lib/agent/tasteContext";
import { resolveTitle, titleKind } from "@/lib/agent/tools/taste";
import type { IndustryGraph, NodeInfo } from "@/lib/graph/engine";
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
    const model = scriptedModel([{ tool: "my_profile", input: {} }, { text: "?" }]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("what do i like")], followups: false }));
    const system = String(model.doStreamCalls[0].prompt.find((m) => m.role === "system")?.content);
    expect(system).not.toContain("This user is signed in");
    // The tool does not exist for a signed-out request: the SDK reports the call as an error rather than running it.
    expect(ofType(chunks, "tool-output-available")).toHaveLength(0);
  });

  it("the tonight tool picks on demand, with a real reason and nothing stored", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.setServices("u1", { providerIds: [15] });
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "swipe" }]);
    const model = scriptedModel([{ tool: "tonight", input: {} }, { text: "ok" }]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("what should i watch")], followups: false, userId: "u1", taste: store }));
    const out = ofType(chunks, "tool-output-available")[0].output as { picks: { title: string; reason: string; providers: string[] }[] };
    expect(out.picks.length).toBeGreaterThan(0);
    expect(out.picks.length).toBeLessThanOrEqual(3);
    expect(out.picks.some((p) => p.title.startsWith("Forrest Gump"))).toBe(true);
    expect(out.picks[0].reason.length).toBeGreaterThan(0);
    // On demand means on demand: nothing derived is written.
    expect(await store.getTaste("u1")).toBeNull();
  });

  it("the tonight tool post-filters by the service the user named", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "swipe" }]);
    const model = scriptedModel([{ tool: "tonight", input: { service: "Netflix" } }, { text: "ok" }]);
    const chunks = await collect(runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("anything on netflix?")], followups: false, userId: "u1", taste: store }));
    // The fixture has no TMDB, so nothing carries a provider: the tool says so
    // rather than handing back picks that are not on Netflix.
    expect(ofType(chunks, "tool-output-available")[0].output).toMatchObject({ empty: true, service: "Netflix" });
  });
});

/** A title node as `resolveTitle` reads one: name, year, type, votes. */
function titleNode(imdbId: string, name: string, year: number, titleType: string, votes: number): NodeInfo {
  return { id: Number(imdbId.slice(2)), kind: "title", imdbId, name, year, titleType, votes, genres: "" } as unknown as NodeInfo;
}

/** A graph stub with just the two lookups `resolveTitle` uses. */
function stubGraph(nodes: NodeInfo[]): IndustryGraph {
  return {
    searchByName: (query: string, limit = 10) => nodes.filter((n) => n.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, limit),
    nodeByImdbId: (id: string) => nodes.find((n) => n.imdbId === id),
  } as unknown as IndustryGraph;
}

const SHADOWS_FILM = titleNode("tt3416742", "What We Do in the Shadows", 2014, "movie", 200_000);
const SHADOWS_SHOW = titleNode("tt7908628", "What We Do in the Shadows", 2019, "tvSeries", 120_000);
const SHADOWS_SHORT = titleNode("tt9999999", "What We Do in the Shadows", 2005, "movie", 900);

describe("resolving a title the user named (v5.1)", () => {
  it("prefers the asked kind when a name is both a film and a show", () => {
    const graph = stubGraph([SHADOWS_FILM, SHADOWS_SHOW]);
    const show = resolveTitle(graph, { query: "What We Do in the Shadows", kind: "show" });
    expect(show).toMatchObject({ node: { imdbId: SHADOWS_SHOW.imdbId } });
    const film = resolveTitle(graph, { query: "What We Do in the Shadows", kind: "film" });
    expect(film).toMatchObject({ node: { imdbId: SHADOWS_FILM.imdbId } });
  });

  it("comes back ambiguous when two strong titles of the asked kind answer to the name", () => {
    const other = titleNode("tt1111111", "What We Do in the Shadows", 2023, "tvSeries", 90_000);
    const r = resolveTitle(stubGraph([SHADOWS_SHOW, other, SHADOWS_FILM]), { query: "What We Do in the Shadows", kind: "show" });
    expect(r).toMatchObject({ ambiguous: true });
    const candidates = (r as { candidates: { imdbId: string; kind: string; year: number }[] }).candidates;
    expect(candidates.map((c) => c.imdbId).sort()).toEqual([other.imdbId, SHADOWS_SHOW.imdbId].sort());
    expect(candidates.every((c) => c.kind === "show")).toBe(true);
    expect(candidates.map((c) => c.year)).toContain(2019);
  });

  it("no kind and two strong titles is ambiguous; a weak namesake is not", () => {
    expect(resolveTitle(stubGraph([SHADOWS_FILM, SHADOWS_SHOW]), { query: "What We Do in the Shadows" })).toMatchObject({ ambiguous: true });
    // A namesake with a hundredth of the votes is not a real second candidate.
    expect(resolveTitle(stubGraph([SHADOWS_FILM, SHADOWS_SHORT]), { query: "What We Do in the Shadows" })).toMatchObject({
      node: { imdbId: SHADOWS_FILM.imdbId },
    });
  });

  it("an id wins outright, and an unknown name is an error, not a guess", () => {
    const graph = stubGraph([SHADOWS_FILM, SHADOWS_SHOW]);
    expect(resolveTitle(graph, { imdbId: SHADOWS_SHOW.imdbId, kind: "film" })).toMatchObject({ node: { imdbId: SHADOWS_SHOW.imdbId } });
    expect(resolveTitle(graph, { query: "Nothing By That Name" })).toMatchObject({ error: "unknown_title" });
  });

  it("titleKind reads the graph's title type", () => {
    expect(titleKind(SHADOWS_SHOW)).toBe("show");
    expect(titleKind(SHADOWS_FILM)).toBe("film");
  });
});

describe("the log tool (v5.1)", () => {
  async function runLog(input: Record<string, unknown>, store = new MemoryTasteStore()) {
    const graph = await fixtureGraph();
    const model = scriptedModel([{ tool: "log", input }, { text: "Logged." }]);
    const chunks = await collect(
      runAgent({ model, graph, brain: new MemoryBrain(), tmdb: null, messages: [userMessage("log this")], followups: false, userId: "u1", taste: store }),
    );
    return { out: ofType(chunks, "tool-output-available")[0].output as Record<string, unknown>, store };
  }

  it("keeps a one-decimal score exactly, and says the kind back", async () => {
    const { out, store } = await runLog({ query: "Good Series", kind: "show", score: 9.7 });
    expect(out).toMatchObject({ ok: true, state: "rated", score: 9.7, kind: "show" });
    expect((await store.listWatched("u1"))[0]).toMatchObject({ titleImdbId: GOOD_SERIES, rating: "rated", score: 9.7, source: "chat" });
    expect((await store.listEpisodes("u1"))[0].text).toContain("9.7/10");
  });

  it("a title with no score and no state is seen, not a question back", async () => {
    const { out, store } = await runLog({ query: "Good Series", kind: "show" });
    expect(out).toMatchObject({ ok: true, state: "seen", score: null });
    expect((await store.listWatched("u1"))[0]).toMatchObject({ rating: "seen", score: null });
  });

  it("a season sets the pointer and shows up in the episode line", async () => {
    const { out, store } = await runLog({ query: "Good Series", kind: "show", score: 8, season: 4 });
    expect(out).toMatchObject({ ok: true, season: 4 });
    expect((await store.listWatched("u1"))[0]).toMatchObject({ rating: "rated", score: 8, season: 4 });
    expect((await store.listEpisodes("u1")).some((e) => e.text.includes("season 4"))).toBe(true);
  });

  it("the show kind picks the series over the film when the name is searched", async () => {
    // The fixture has one series and one film whose names both contain "Series".
    const { out } = await runLog({ query: "Mini Series", kind: "show", score: 7 });
    expect(out).toMatchObject({ ok: true, kind: "show" });
  });

  it("refuses a score with two decimals and writes nothing", async () => {
    const { out, store } = await runLog({ query: "Good Series", score: 9.75 });
    expect(out).toMatchObject({ error: expect.stringContaining("decimal") });
    expect(await store.listWatched("u1")).toEqual([]);
  });
});
