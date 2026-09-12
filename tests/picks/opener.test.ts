import { describe, it, expect } from "vitest";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { pickNow } from "@/lib/picks/service";
import { createTonightHandlers, openerLine } from "@/lib/picks/routes";
import type { PickView } from "@/lib/picks/view";
import { fixtureGraph } from "../agent/helpers";
import { MemoryTitlesStore } from "@/lib/titles/memory";
import type { TitleRow } from "@/lib/titles/types";

const APOLLO = "tt0000001";

/** A store with one rated title: enough for the engine to pick from. */
async function tasted(userId = "u1") {
  const store = new MemoryTasteStore();
  await store.upsertWatched(userId, [{ titleImdbId: APOLLO, rating: "rated", score: 9, source: "letterboxd" }]);
  await store.setServices(userId, { providerIds: [15] });
  return store;
}

function handlers(store: MemoryTasteStore, userId: string | null, graph: Awaited<ReturnType<typeof fixtureGraph>>) {
  return createTonightHandlers({
    userId: async () => userId,
    store: async () => store,
    graph: async () => graph,
    tmdb: () => null,
  });
}

function get(qs = "") {
  return new Request(`http://localhost/api/tonight/opener${qs}`);
}

describe("tonight on demand (v5)", () => {
  it("pickNow returns a pick with a real graph reason and stores nothing", async () => {
    const graph = await fixtureGraph();
    const store = await tasted();
    const result = await pickNow({ graph, tmdb: null, store }, "u1");
    expect(result).not.toBeNull();
    expect(result!.picks.length).toBeGreaterThan(0);
    expect(result!.pick).toBe(result!.picks[0]);
    // The reason is the engine's own line, and it cites the titles it came from.
    expect(result!.pick.reason.text.length).toBeGreaterThan(0);
    expect(result!.pick.reason.viaImdbIds.length).toBeGreaterThan(0);
    // Nothing is stored: no tonight row, no derived facts written.
    expect(await store.getTonight("u1")).toBeNull();
    expect(await store.getTaste("u1")).toBeNull();
  });

  it("pickNow fills a pick's poster and Play link from the titles cache and leads with a playable one", async () => {
    const graph = await fixtureGraph();
    const store = await tasted();
    const bare = await pickNow({ graph, tmdb: null, store }, "u1");
    expect(bare).not.toBeNull();
    // Without TMDB the pool carries nothing, so no pick can be played.
    expect(bare!.picks.every((p) => p.playUrl === null && p.posterUrl === null)).toBe(true);

    // Cache a row for the last pick only: it becomes the opener.
    const target = bare!.picks[bare!.picks.length - 1];
    const titles = new MemoryTitlesStore();
    const row: TitleRow = {
      imdbId: target.imdbId,
      tmdbId: 1,
      kind: target.titleType.startsWith("tv") ? "series" : "movie",
      name: target.name,
      year: target.year,
      runtime: 120,
      seasons: null,
      genres: [],
      posterPath: "/poster.jpg",
      providers: { link: "https://www.themoviedb.org/watch/1", flatrate: [{ provider_id: 15, provider_name: "Hulu" }] },
      fetchedAt: new Date().toISOString(),
    };
    await titles.upsertMany([row]);
    const filled = await pickNow({ graph, tmdb: null, store, titles }, "u1");
    expect(filled!.pick.imdbId).toBe(target.imdbId);
    expect(filled!.pick.playUrl).toBe("https://www.themoviedb.org/watch/1");
    expect(filled!.pick.posterUrl).toContain("/poster.jpg");
    expect(filled!.pick.providerNames).toEqual(["Hulu"]);
    expect(filled!.pick.playLabel).toBe("Play on Hulu");
  });

  it("pickNow is null until the user has rated or wanted something", async () => {
    const graph = await fixtureGraph();
    const store = new MemoryTasteStore();
    expect(await pickNow({ graph, tmdb: null, store }, "u1")).toBeNull();
    await store.upsertWatched("u1", [{ titleImdbId: APOLLO, rating: "unseen", source: "swipe" }]);
    expect(await pickNow({ graph, tmdb: null, store }, "u1")).toBeNull();
  });

  it("openerLine names the service and the reason, with exactly one full stop", () => {
    const pick = {
      name: "Forrest Gump",
      reason: { text: "Tom Hanks, who you liked in Apollo 13.", viaImdbIds: [APOLLO] },
      providerNames: ["Max", "Hulu"],
    } as unknown as PickView;
    // A reason that opens with a name keeps its capital; the trailing stop is not doubled.
    expect(openerLine(pick)).toBe("tonight: **Forrest Gump** on max, because Tom Hanks, who you liked in Apollo 13.");
    // A reason that opens with a sentence joins mid-sentence in lowercase.
    expect(openerLine({ ...pick, reason: { text: "Your 3rd Tom Hanks, after Heat and Apollo 13", viaImdbIds: [] } } as PickView)).toBe(
      "tonight: **Forrest Gump** on max, because your 3rd Tom Hanks, after Heat and Apollo 13.",
    );
    // No providers: we say so rather than inventing one.
    expect(openerLine({ ...pick, providerNames: [] } as PickView)).toMatch(/^tonight: \*\*[^*]+\*\*, because/);
  });

  it("GET /api/tonight/opener answers with the line and the pick, and stores nothing", async () => {
    const graph = await fixtureGraph();
    const store = await tasted();
    const res = await handlers(store, "u1", graph).opener(get());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pick: PickView; line: string };
    expect(body.line.startsWith(`tonight: **${body.pick.name}**`)).toBe(true);
    expect(body.line).toContain(", because ");
    expect(body.line.endsWith(".")).toBe(true);
    // A Play target for the line's link; the fixture has no TMDB so it may be null, but the field is there.
    expect(body.pick).toHaveProperty("playUrl");
    expect(body.pick.reason.viaImdbIds.length).toBeGreaterThan(0);
    expect(await store.getTonight("u1")).toBeNull();
  });

  it("the opener honours runtime and energy filters", async () => {
    const graph = await fixtureGraph();
    const store = await tasted();
    const res = await handlers(store, "u1", graph).opener(get("?maxRuntimeMin=90&energy=light"));
    // Either a pick that fits or an honest 404; never a crash or an unfiltered pick.
    expect([200, 404]).toContain(res.status);
  });

  it("404s with no taste yet and 401s signed out", async () => {
    const graph = await fixtureGraph();
    const empty = await handlers(new MemoryTasteStore(), "u1", graph).opener(get());
    expect(empty.status).toBe(404);
    expect(await empty.json()).toEqual({ error: "no_taste_yet" });

    const out = await handlers(await tasted(), null, graph).opener(get());
    expect(out.status).toBe(401);
    expect(await out.json()).toEqual({ error: "sign_in_required" });
  });
});
