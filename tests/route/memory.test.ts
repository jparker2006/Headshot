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
    expect(await (await handlers.getMemory(get())).json()).toEqual({ markdown: "", pinned: "", updatedAt: null });

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

  it("a log schedules exactly one memory rewrite for that user", async () => {
    const res = await handlers.log(
      new Request("https://headshot.test/api/taste/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imdbId: "tt0000001", rating: "liked", text: "still holds up" }),
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
