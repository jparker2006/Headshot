/**
 * DELETE /api/me — delete account (SPEC v5, Settings). On the route seam with
 * memory stores: signed out is 401, signed in empties every per-user table
 * this app owns and leaves other users alone.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createAccountHandlers } from "@/lib/auth/routes";
import { MemoryTasteStore } from "@/lib/taste/memory";
import { MemoryThreadStore } from "@/lib/threads/memory";

let taste: MemoryTasteStore;
let threads: MemoryThreadStore;
let signedInAs: string | null;
let authDeletions: number;
let authResult: "deleted" | "unsupported" | "failed";

const handlers = createAccountHandlers({
  userId: async () => signedInAs,
  taste: async () => taste,
  threads: async () => threads,
  deleteAuthUser: async () => {
    authDeletions++;
    return authResult;
  },
});

const del = () => new Request("https://headshot.test/api/me", { method: "DELETE" });

async function seed(userId: string) {
  await taste.upsertWatched(userId, [{ titleImdbId: "tt0000001", rating: "rated", score: 8, source: "log" }]);
  await taste.setServices(userId, { providerIds: [15] });
  await taste.setMemory(userId, { markdown: "You like astronauts." });
  await taste.addEpisodes(userId, [{ kind: "log", text: "rated Apollo 13 8/10" }]);
  await taste.startCrawl(userId, "letterboxd", "jake");
  const thread = await threads.createThread(userId, { id: `t-${userId}` });
  await threads.appendMessages(userId, thread.id, [{ id: `m-${userId}`, role: "user", parts: [{ type: "text", text: "hi" }] }]);
}

beforeEach(() => {
  taste = new MemoryTasteStore();
  threads = new MemoryThreadStore();
  signedInAs = "user-1";
  authDeletions = 0;
  authResult = "deleted";
});

describe("DELETE /api/me", () => {
  it("refuses a signed-out request and deletes nothing", async () => {
    await seed("user-1");
    signedInAs = null;
    const res = await handlers.deleteMe(del());
    expect(res.status).toBe(401);
    expect(await taste.listWatched("user-1")).toHaveLength(1);
    expect(authDeletions).toBe(0);
  });

  it("empties every table of theirs and then the auth account", async () => {
    await seed("user-1");
    await seed("user-2");

    const res = await handlers.deleteMe(del());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, account: "deleted" });
    expect(authDeletions).toBe(1);

    expect(await taste.listWatched("user-1")).toEqual([]);
    expect(await taste.getServices("user-1")).toBeNull();
    expect(await taste.getMemory("user-1")).toBeNull();
    expect(await taste.listEpisodes("user-1")).toEqual([]);
    expect(await taste.getCrawl("user-1", "letterboxd")).toBeNull();
    expect(await threads.listThreads("user-1")).toEqual([]);

    // Someone else's account is untouched.
    expect(await taste.listWatched("user-2")).toHaveLength(1);
    expect(await threads.listThreads("user-2")).toHaveLength(1);
  });

  it("still reports ok when the auth server cannot delete the row, and says so", async () => {
    await seed("user-1");
    authResult = "failed";
    const res = await handlers.deleteMe(del());
    expect(res.status).toBe(200);
    // The data is gone either way; the caller learns the auth row may remain.
    expect(await res.json()).toEqual({ ok: true, account: "failed" });
    expect(await taste.listWatched("user-1")).toEqual([]);
  });
});
