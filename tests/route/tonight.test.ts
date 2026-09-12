import { beforeEach, describe, expect, it } from "vitest";
import { createTonightHandlers } from "@/lib/picks/routes";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { fixtureGraph } from "../agent/helpers";

const APOLLO = "tt0000001";
const GUMP = "tt0000002";

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

const get = (path = "/api/tonight/opener") => new Request(`https://headshot.test${path}`);
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
    for (const r of [handlers.opener(get("/api/tonight/opener")), handlers.deck(get("/api/taste/deck")), handlers.swipe(post("/api/taste/swipe", { rows: [] })), handlers.session(post("/api/taste/swipe/session", { rows: [{ imdbId: APOLLO, score: 8 }] }))]) {
      expect((await r).status).toBe(401);
    }
  });

  it("the deck skips titles already rated, reports its mode and honours ?size=", async () => {
    await store.upsertWatched("user-1", [{ titleImdbId: APOLLO, rating: "rated", score: 8, source: "swipe" }]);
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
    const res = await handlers.swipe(post("/api/taste/swipe", { rows: [{ imdbId: APOLLO, score: 9 }, { imdbId: "bad", score: 9 }, { imdbId: GUMP, score: 99 }] }));
    expect(await res.json()).toEqual({ ok: true, saved: 1 });
    expect((await store.listWatched("user-1"))[0]).toMatchObject({ titleImdbId: APOLLO, rating: "rated", score: 9, source: "swipe" });
    await handlers.swipe(post("/api/taste/swipe", { rows: [{ imdbId: APOLLO, score: 5 }] }));
    expect((await store.listWatched("user-1"))[0].score).toBe(5);
    // The drawer's swipe keeps scheduling the rewrite in the background; it never awaits one.
    expect(rewrites.scheduled).toEqual(["user-1", "user-1"]);
    expect(rewrites.awaited).toEqual([]);
  });
  it("a session writes the rows, one episode, and exactly one awaited rewrite", async () => {
    rewriteResult = "You like astronauts.\nYou keep coming back to Gary Sinise.";
    const res = await handlers.session(
      post("/api/taste/swipe/session", {
        rows: [
          { imdbId: APOLLO, score: 9 },
          { imdbId: GUMP, score: 4 },
          { imdbId: "bad", score: 9 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { before: string; after: string; diff: { added: string[]; removed: string[] }; rewritten: boolean };

    expect((await store.listWatched("user-1")).map((r) => [r.titleImdbId, r.score, r.source])).toEqual([
      [APOLLO, 9, "swipe"],
      [GUMP, 4, "swipe"],
    ]);
    const episodes = await store.listEpisodes("user-1");
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ kind: "swipe", text: "swiped: rated 9: Apollo 13; 4: Forrest Gump" });

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
    const body = (await (await handlers.session(post("/api/taste/swipe/session", { rows: [{ imdbId: APOLLO, score: 8 }] }))).json()) as {
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
    const skipped = (await (await handlers.session(post("/api/taste/swipe/session", { rows: [{ imdbId: APOLLO, score: 8 }] }))).json()) as {
      before: string;
      after: string;
      diff: unknown;
      rewritten: boolean;
    };
    expect(skipped).toEqual({ before: "You like astronauts.", after: "You like astronauts.", diff: { added: [], removed: [] }, rewritten: false });
    // The rows still landed; only the prose is missing.
    expect((await store.listWatched("user-1"))[0]).toMatchObject({ titleImdbId: APOLLO, rating: "rated", score: 8 });

    rewriteResult = () => {
      throw new Error("openrouter down");
    };
    const failed = await handlers.session(post("/api/taste/swipe/session", { rows: [{ imdbId: GUMP, score: 8 }] }));
    expect(failed.status).toBe(200);
    expect((await failed.json()).rewritten).toBe(false);
  });

  it("a session with no usable rows is a 400 and writes nothing", async () => {
    for (const bad of [{}, { rows: "nope" }, { rows: [] }, { rows: [{ imdbId: "bad", score: 8 }, { imdbId: APOLLO, rating: "nope" }, { imdbId: APOLLO, rating: "liked" }] }]) {
      expect((await handlers.session(post("/api/taste/swipe/session", bad))).status).toBe(400);
    }
    expect(await store.listWatched("user-1")).toEqual([]);
    expect(await store.listEpisodes("user-1")).toEqual([]);
    expect(rewrites).toEqual({ scheduled: [], awaited: [] });
  });
});
