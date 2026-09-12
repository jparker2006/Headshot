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
/** Calls to each of the two rewrite seams, so a session can prove it fires one. */
let rewrites: { scheduled: string[]; awaited: string[] };
/** What the awaited rewrite hands back: the new markdown, or null when it could not run. */
let rewriteResult: string | null | (() => never);
const handlers = createTonightHandlers({
  userId: async () => signedInAs,
  store: async () => store,
  graph: fixtureGraph,
  tmdb: () => null,
  rewrite: async (userId) => {
    rewrites.scheduled.push(userId);
  },
  rewriteNow: async (userId) => {
    rewrites.awaited.push(userId);
    return typeof rewriteResult === "function" ? rewriteResult() : rewriteResult;
  },
});

const get = (path = "/api/tonight") => new Request(`https://headshot.test${path}`);
const post = (path: string, body: unknown) => new Request(`https://headshot.test${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  store = new MemoryTasteStore();
  signedInAs = "user-1";
  rewrites = { scheduled: [], awaited: [] };
  rewriteResult = null;
});

describe("tonight routes", () => {
  it("refuses signed-out requests", async () => {
    signedInAs = null;
    for (const r of [handlers.get(get()), handlers.refresh(post("/api/tonight/refresh", {})), handlers.later(post("/api/taste/later", { imdbId: GUMP })), handlers.swipe(post("/api/taste/swipe", { rows: [] })), handlers.session(post("/api/taste/swipe/session", { rows: [{ imdbId: APOLLO, rating: "liked" }] }))]) {
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

  it("the deck skips titles already rated, reports its mode and honours ?size=", async () => {
    await store.upsertWatched("user-1", [{ titleImdbId: APOLLO, rating: "liked", source: "swipe" }]);
    const res = await handlers.deck(get("/api/taste/deck"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cards: { imdbId: string; name: string; year: number; kind: string }[]; mode: string };
    expect(body.cards.length).toBeGreaterThan(0);
    expect(body.cards.map((c) => c.imdbId)).not.toContain(APOLLO);
    // One liked title is cold start: the fixed deck, with the year and kind the cards carry.
    expect(body.mode).toBe("cold");
    expect(body.cards[0].year).toBeGreaterThan(0);
    expect(["film", "show"]).toContain(body.cards[0].kind);

    const capped = (await (await handlers.deck(get("/api/taste/deck?size=2"))).json()) as { cards: unknown[] };
    expect(capped.cards).toHaveLength(2);
  });

  it("swipe stores committed rows with last action wins, ignoring junk", async () => {
    const res = await handlers.swipe(post("/api/taste/swipe", { rows: [{ imdbId: APOLLO, rating: "liked" }, { imdbId: "bad", rating: "liked" }, { imdbId: GUMP, rating: "nope" }] }));
    expect(await res.json()).toEqual({ ok: true, saved: 1 });
    expect((await store.listWatched("user-1"))[0]).toMatchObject({ titleImdbId: APOLLO, rating: "liked", source: "swipe" });
    await handlers.swipe(post("/api/taste/swipe", { rows: [{ imdbId: APOLLO, rating: "meh" }] }));
    expect((await store.listWatched("user-1"))[0].rating).toBe("meh");
    // The drawer's swipe keeps scheduling the rewrite in the background; it never awaits one.
    expect(rewrites.scheduled).toEqual(["user-1", "user-1"]);
    expect(rewrites.awaited).toEqual([]);
  });
  it("a session writes the rows, one episode, and exactly one awaited rewrite", async () => {
    rewriteResult = "You like astronauts.\nYou keep coming back to Gary Sinise.";
    const res = await handlers.session(
      post("/api/taste/swipe/session", {
        rows: [
          { imdbId: APOLLO, rating: "liked" },
          { imdbId: GUMP, rating: "meh" },
          { imdbId: "bad", rating: "liked" },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { before: string; after: string; diff: { added: string[]; removed: string[] }; rewritten: boolean };

    expect((await store.listWatched("user-1")).map((r) => [r.titleImdbId, r.rating, r.source])).toEqual([
      [APOLLO, "liked", "swipe"],
      [GUMP, "meh", "swipe"],
    ]);
    const episodes = await store.listEpisodes("user-1");
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ kind: "swipe", text: "swiped: liked Apollo 13; meh Forrest Gump" });

    // One rewrite, and it is the awaited one: the scheduled seam must stay quiet.
    expect(rewrites.awaited).toEqual(["user-1"]);
    expect(rewrites.scheduled).toEqual([]);

    expect(body.rewritten).toBe(true);
    expect(body.before).toBe("");
    expect(body.after).toBe(rewriteResult);
    expect(body.diff).toEqual({ added: ["You like astronauts.", "You keep coming back to Gary Sinise."], removed: [] });
  });

  it("a session diffs the memory it had against the one the rewrite returned", async () => {
    await store.setMemory("user-1", { markdown: "You like astronauts.\nYou finish series." });
    rewriteResult = "You finish series.\nYou keep coming back to Gary Sinise.";
    const body = (await (await handlers.session(post("/api/taste/swipe/session", { rows: [{ imdbId: APOLLO, rating: "liked" }] }))).json()) as {
      before: string;
      after: string;
      diff: { added: string[]; removed: string[] };
    };
    expect(body.before).toBe("You like astronauts.\nYou finish series.");
    expect(body.after).toBe(rewriteResult);
    expect(body.diff).toEqual({ added: ["You keep coming back to Gary Sinise."], removed: ["You like astronauts."] });
  });

  it("a skipped or failed rewrite is not an error: rewritten false, empty diff, memory unchanged", async () => {
    await store.setMemory("user-1", { markdown: "You like astronauts." });
    rewriteResult = null; // no model in keyless dev
    const skipped = (await (await handlers.session(post("/api/taste/swipe/session", { rows: [{ imdbId: APOLLO, rating: "liked" }] }))).json()) as {
      before: string;
      after: string;
      diff: unknown;
      rewritten: boolean;
    };
    expect(skipped).toEqual({ before: "You like astronauts.", after: "You like astronauts.", diff: { added: [], removed: [] }, rewritten: false });
    // The rows still landed; only the prose is missing.
    expect((await store.listWatched("user-1"))[0]).toMatchObject({ titleImdbId: APOLLO, rating: "liked" });

    rewriteResult = () => {
      throw new Error("openrouter down");
    };
    const failed = await handlers.session(post("/api/taste/swipe/session", { rows: [{ imdbId: GUMP, rating: "liked" }] }));
    expect(failed.status).toBe(200);
    expect((await failed.json()).rewritten).toBe(false);
  });

  it("a session with no usable rows is a 400 and writes nothing", async () => {
    for (const bad of [{}, { rows: "nope" }, { rows: [] }, { rows: [{ imdbId: "bad", rating: "liked" }, { imdbId: APOLLO, rating: "nope" }] }]) {
      expect((await handlers.session(post("/api/taste/swipe/session", bad))).status).toBe(400);
    }
    expect(await store.listWatched("user-1")).toEqual([]);
    expect(await store.listEpisodes("user-1")).toEqual([]);
    expect(rewrites).toEqual({ scheduled: [], awaited: [] });
  });
});
