import { describe, it, expect } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { cronAuthorized, runNightly } from "@/lib/picks/cron";
import { fixtureGraph } from "../agent/helpers";

const APOLLO = "tt0000001";
const GUMP = "tt0000002";

/** A model that answers every narration request with couch-voice lines that keep the names. */
function reasonModel() {
  const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };
  return new MockLanguageModelV4({
    doGenerate: async (opts) => {
      const prompt = JSON.stringify(opts.prompt);
      const n = (prompt.match(/\d+\. /g) ?? []).length;
      const lines = Array.from({ length: n }, (_, i) => `${i + 1}. ok so **Tom Hanks** and **Gary Sinise**, both in **Apollo 13** which you liked (mock ${i})`);
      return { content: [{ type: "text", text: lines.join("\n") }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
    },
    doStream: async () => ({ stream: simulateReadableStream<LanguageModelV4StreamPart>({ chunks: [] }) }),
  });
}

describe("nightly cron", () => {
  it("computes and stores picks for every active user, with mocked reason lines, and skips users with no taste", async () => {
    const graph = await fixtureGraph();
    let clock = new Date("2026-07-01T00:00:00.000Z");
    const store = new MemoryTasteStore({ now: () => clock });
    await store.upsertWatched("stale", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "swipe" }]);
    clock = new Date("2026-09-10T00:00:00.000Z");
    await store.upsertWatched("jake", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "letterboxd" }]);
    await store.setServices("jake", { providerIds: [15] });
    await store.setServices("empty", { providerIds: [8] }); // services but nothing rated

    const model = reasonModel();
    const r = await runNightly({ graph, tmdb: null, store, model }, { now: () => new Date("2026-09-11T11:00:00.000Z") });
    expect(r.users).toBe(2); // jake and empty; stale is older than 30 days
    expect(r.computed).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.failed).toEqual([]);
    expect(model.doGenerateCalls).toHaveLength(1);

    const stored = await store.getTonight("jake");
    expect(stored).not.toBeNull();
    const data = stored!.data as { picks: { imdbId: string; reason: { text: string } }[]; deck: unknown[] };
    expect(data.picks.length).toBeGreaterThan(0);
    // The guard kept the mocked line only where every cited name survived; Gump's cites Hanks, Sinise, Apollo 13.
    const gump = data.picks.find((p) => p.imdbId === GUMP);
    expect(gump?.reason.text).toContain("**Tom Hanks**");
    expect(await store.getTonight("empty")).toBeNull();
    expect(await store.getTonight("stale")).toBeNull();
  });

  it("only Vercel Cron's bearer secret is accepted", () => {
    const req = (auth?: string) => new Request("https://headshot.test/api/cron/tonight", { headers: auth ? { authorization: auth } : {} });
    expect(cronAuthorized(req("Bearer s3cret"), "s3cret")).toBe(true);
    expect(cronAuthorized(req("Bearer nope"), "s3cret")).toBe(false);
    expect(cronAuthorized(req(), "s3cret")).toBe(false);
    expect(cronAuthorized(req("Bearer s3cret"), undefined)).toBe(false);
  });
});
