import { beforeEach, describe, expect, it } from "vitest";
import { createTasteHandlers, MAX_PINNED_CHARS } from "@/lib/taste/routes";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { fixtureGraph } from "../agent/helpers";

let store: MemoryTasteStore;
let signedInAs: string | null;
let scheduled: Promise<void>[];
let rewrites: string[];

const handlers = createTasteHandlers({
  userId: async () => signedInAs,
  store: async () => store,
  graph: fixtureGraph,
  tmdb: () => null,
  schedule: (work) => scheduled.push(work()),
  rewrite: async (userId) => {
    rewrites.push(userId);
  },
});

beforeEach(() => {
  store = new MemoryTasteStore();
  signedInAs = "user-1";
  scheduled = [];
  rewrites = [];
});

const get = () => new Request("https://headshot.test/api/taste/memory");
const put = (body: unknown) =>
  new Request("https://headshot.test/api/taste/memory", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("memory route", () => {
  it("answers 401 signed out, for both verbs", async () => {
    signedInAs = null;
    expect((await handlers.getMemory(get())).status).toBe(401);
    expect((await handlers.putMemory(put({ pinned: "hi" }))).status).toBe(401);
    expect(await store.getMemory("user-1")).toBeNull();
  });

  it("is empty strings before the first rewrite, then round-trips the pinned block", async () => {
    expect(await (await handlers.getMemory(get())).json()).toEqual({ markdown: "", pinned: "", dropped: [], updatedAt: null, claims: null });

    const res = await handlers.putMemory(put({ pinned: "i will never watch a musical." }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const body = await (await handlers.getMemory(get())).json();
    expect(body.pinned).toBe("i will never watch a musical.");
    expect(body.markdown).toBe("");
    expect(typeof body.updatedAt).toBe("string");
  });

  it("a pinned edit never touches the markdown the rewrite owns", async () => {
    await store.setMemory("user-1", { markdown: "## What you love\n- heists" });
    await handlers.putMemory(put({ pinned: "and musicals, never" }));
    const body = await (await handlers.getMemory(get())).json();
    expect(body.markdown).toBe("## What you love\n- heists");
    expect(body.pinned).toBe("and musicals, never");
  });

  it("rejects a missing field, a bad body, and an oversized block", async () => {
    expect((await handlers.putMemory(put({}))).status).toBe(400);
    expect((await handlers.putMemory(put({ pinned: 12 }))).status).toBe(400);
    expect((await handlers.putMemory(new Request("https://headshot.test/api/taste/memory", { method: "PUT", body: "{" }))).status).toBe(400);
    const tooLong = await handlers.putMemory(put({ pinned: "x".repeat(MAX_PINNED_CHARS + 1) }));
    expect(tooLong.status).toBe(400);
    expect(await store.getMemory("user-1")).toBeNull();
    expect((await handlers.putMemory(put({ pinned: "x".repeat(MAX_PINNED_CHARS) }))).status).toBe(200);
  });

  it("reports what the last rewrite dropped, and dismisses it", async () => {
    await store.setMemory("user-1", { markdown: "prose", dropped: ["The Wire", "Heat"] });
    expect((await (await handlers.getMemory(get())).json()).dropped).toEqual(["The Wire", "Heat"]);

    const res = await handlers.putMemory(put({ dismissDropped: true }));
    expect(res.status).toBe(200);
    const body = await (await handlers.getMemory(get())).json();
    expect(body.dropped).toEqual([]);
    // Dismissing touches nothing else.
    expect(body.markdown).toBe("prose");
  });

  it("rejectClaim moves the claim to rejected, clears the rows hash, and schedules a rewrite", async () => {
    const claims = {
      sentence: "you like a long fuse",
      claims: [
        { id: "c_00000001", text: "crime with a long fuse", evidence: ["tt0000001"], polarity: "love" as const },
        { id: "c_00000002", text: "musicals, apparently", evidence: ["tt0000002"], polarity: "love" as const },
      ],
      rejected: [],
    };
    await store.setMemory("user-1", { markdown: "prose", claims, rowsHash: "abc" });

    // GET carries the claims the client renders.
    expect((await (await handlers.getMemory(get())).json()).claims).toEqual(claims);

    const res = await handlers.putMemory(put({ rejectClaim: "c_00000002" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    await Promise.all(scheduled);

    const row = (await store.getMemory("user-1"))!;
    expect(row.claims!.claims.map((c) => c.id)).toEqual(["c_00000001"]);
    expect(row.claims!.rejected).toEqual([{ text: "musicals, apparently" }]);
    // Forced: the rows have not changed, so without this the rewrite no-ops.
    expect(row.rowsHash).toBe("");
    expect(row.markdown).toBe("prose");
    expect(rewrites).toEqual(["user-1"]);

    // Idempotent: an id that is not there is still a 200 and changes nothing.
    const again = await handlers.putMemory(put({ rejectClaim: "c_00000002" }));
    expect(again.status).toBe(200);
    expect((await store.getMemory("user-1"))!.claims!.rejected).toEqual([{ text: "musicals, apparently" }]);
    expect(rewrites).toEqual(["user-1"]);
  });

  it("delete removes the row and its logging episodes, and schedules a rewrite", async () => {
    const del = (body: unknown) =>
      new Request("https://headshot.test/api/taste/log", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    await store.upsertWatched("user-1", [
      { titleImdbId: "tt0000001", rating: "rated", score: 8, source: "log" },
      { titleImdbId: "tt0000002", rating: "rated", score: 9, source: "log" },
    ]);
    await store.addEpisodes("user-1", [
      { kind: "log", titleImdbId: "tt0000001", text: 'rated Apollo 13 (1995) 8/10: "still holds up"' },
      { kind: "log", titleImdbId: "tt0000002", text: "rated Forrest Gump (1994) 9/10" },
      { kind: "chat", titleImdbId: null, text: "i love a slow burn" },
    ]);

    const res = await handlers.deleteLog(del({ imdbId: "tt0000001" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    await Promise.all(scheduled);

    expect((await store.listWatched("user-1")).map((r) => r.titleImdbId)).toEqual(["tt0000002"]);
    expect((await store.listEpisodes("user-1")).map((e) => e.text)).toEqual([
      "i love a slow burn",
      "rated Forrest Gump (1994) 9/10",
    ]);
    expect(rewrites).toEqual(["user-1"]);

    expect((await handlers.deleteLog(del({ imdbId: "nope" }))).status).toBe(400);
    signedInAs = null;
    expect((await handlers.deleteLog(del({ imdbId: "tt0000002" }))).status).toBe(401);
  });

  it("logging again with no line keeps the note, a new line replaces it", async () => {
    const log = (body: unknown) =>
      new Request("https://headshot.test/api/taste/log", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    await handlers.log(log({ imdbId: "tt0000001", score: 8, text: "still holds up" }));
    await handlers.log(log({ imdbId: "tt0000001", score: 9 }));
    expect((await store.listEpisodes("user-1"))[0].text).toContain('"still holds up"');

    await handlers.log(log({ imdbId: "tt0000001", score: 9, text: "the countdown gets me" }));
    expect((await store.listEpisodes("user-1"))[0].text).toContain('"the countdown gets me"');
    await Promise.all(scheduled);
  });

  it("a log schedules exactly one memory rewrite for that user", async () => {
    const res = await handlers.log(
      new Request("https://headshot.test/api/taste/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imdbId: "tt0000001", score: 8, text: "still holds up" }),
      }),
    );
    expect(res.status).toBe(200);
    await Promise.all(scheduled);
    expect(rewrites).toEqual(["user-1"]);
    // The episode the rewrite will read carries the user's line verbatim.
    const episodes = await store.listEpisodes("user-1");
    expect(episodes[0].text).toContain('"still holds up"');
  });
});
