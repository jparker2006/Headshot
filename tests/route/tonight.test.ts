import { beforeEach, describe, expect, it } from "vitest";
import { createTonightHandlers } from "@/lib/picks/routes";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { fixtureGraph } from "../agent/helpers";

const APOLLO = "tt0000001";
const GUMP = "tt0000002";
const GOOD_SERIES = "tt0000009";
const HULU = 15;

let store: MemoryTasteStore;
let signedInAs: string | null;
const handlers = createTonightHandlers({
  userId: async () => signedInAs,
  store: async () => store,
  graph: fixtureGraph,
  tmdb: () => null,
});

const get = (path = "/api/tonight") => new Request(`https://headshot.test${path}`);
const post = (path: string, body: unknown) => new Request(`https://headshot.test${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  store = new MemoryTasteStore();
  signedInAs = "user-1";
});

describe("tonight routes", () => {
  it("refuses signed-out requests", async () => {
    signedInAs = null;
    for (const r of [handlers.get(get()), handlers.refresh(post("/api/tonight/refresh", {})), handlers.later(post("/api/taste/later", { imdbId: GUMP })), handlers.swipe(post("/api/taste/swipe", { rows: [] }))]) {
      expect((await r).status).toBe(401);
    }
  });

  it("is 404 until the user has rated something", async () => {
    expect((await handlers.get(get())).status).toBe(404);
  });

  it("computes three picks with reasons for a fixture user, stores them, and replays the stored result", async () => {
    await store.setServices("user-1", { providerIds: [HULU] });
    await store.upsertWatched("user-1", [
      { titleImdbId: APOLLO, rating: "liked", source: "letterboxd" },
      { titleImdbId: GOOD_SERIES, rating: "liked", source: "chat", season: 2, episodesWatched: 3 },
    ]);
    const res = await handlers.get(get());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { picks: { imdbId: string; kind: string; reason: { text: string; viaImdbIds: string[] }; playLabel: string | null }[]; deck: unknown[]; laterCount: number; generatedAt: string };
    expect(data.picks).toHaveLength(3);
    expect(data.picks[0]).toMatchObject({ imdbId: GOOD_SERIES, kind: "continue" });
    expect(data.picks[0].reason.text).toContain("season 2");
    const gump = data.picks.find((p) => p.imdbId === GUMP)!;
    expect(gump.reason.text).toContain("Apollo 13");
    expect(gump.reason.viaImdbIds).toContain(APOLLO);
    expect(data.laterCount).toBe(0);
    // Stored: the next GET replays without recomputing (same generatedAt).
    expect((await store.getTonight("user-1"))?.data).toMatchObject({ generatedAt: data.generatedAt });
    const again = (await (await handlers.get(get())).json()) as { generatedAt: string };
    expect(again.generatedAt).toBe(data.generatedAt);
    // Facts were derived alongside.
    expect((await store.getTaste("user-1"))?.facts.people.map((p) => p.name)).toContain("Bill Paxton"); // Apollo 13 + Good Series
  });

  it("later adds the title to Later and a refresh reflects the count and filters", async () => {
    await store.upsertWatched("user-1", [{ titleImdbId: APOLLO, rating: "liked", source: "letterboxd" }]);
    expect((await handlers.later(post("/api/taste/later", { imdbId: GUMP }))).status).toBe(200);
    expect((await store.listWatched("user-1")).find((r) => r.titleImdbId === GUMP)).toMatchObject({ rating: "want", source: "swipe" });
    expect((await handlers.later(post("/api/taste/later", { imdbId: "nm0000001" }))).status).toBe(400);
    const res = await handlers.refresh(post("/api/tonight/refresh", { energy: "heavy" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { laterCount: number; picks: { imdbId: string }[] };
    expect(data.laterCount).toBe(1);
    // A Later title is still pickable: the list drains through picks.
    expect(data.picks.map((p) => p.imdbId)).toContain(GUMP);
  });

  it("the onboarding deck skips titles already rated", async () => {
    await store.upsertWatched("user-1", [{ titleImdbId: APOLLO, rating: "liked", source: "swipe" }]);
    const res = await handlers.deck(get("/api/taste/deck"));
    expect(res.status).toBe(200);
    const { cards } = (await res.json()) as { cards: { imdbId: string; name: string }[] };
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.map((c) => c.imdbId)).not.toContain(APOLLO);
  });

  it("swipe stores committed rows with last action wins, ignoring junk", async () => {
    const res = await handlers.swipe(post("/api/taste/swipe", { rows: [{ imdbId: APOLLO, rating: "liked" }, { imdbId: "bad", rating: "liked" }, { imdbId: GUMP, rating: "nope" }] }));
    expect(await res.json()).toEqual({ ok: true, saved: 1 });
    expect((await store.listWatched("user-1"))[0]).toMatchObject({ titleImdbId: APOLLO, rating: "liked", source: "swipe" });
    await handlers.swipe(post("/api/taste/swipe", { rows: [{ imdbId: APOLLO, rating: "meh" }] }));
    expect((await store.listWatched("user-1"))[0].rating).toBe("meh");
  });
});
