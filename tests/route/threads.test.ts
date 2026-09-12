import { describe, expect, it } from "vitest";
import { createThreadHandlers } from "@/lib/threads/routes";
import { MemoryThreadStore } from "@/lib/threads/memory";
import type { HeadshotUIMessage } from "@/lib/agent/events";

function handlers(userId: string | null, store = new MemoryThreadStore()) {
  return { store, h: createThreadHandlers({ userId: async () => userId, store: async () => store }) };
}

function req(method: string, body?: unknown) {
  return new Request("http://localhost/api/threads", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function user(id: string, text: string): HeadshotUIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

describe("/api/threads (route seam)", () => {
  it("401s every handler when signed out", async () => {
    const { h } = handlers(null);
    for (const res of [
      await h.list(req("GET")),
      await h.create(req("POST", {})),
      await h.get(req("GET"), "thread-01"),
      await h.rename(req("PATCH", { title: "x" }), "thread-01"),
      await h.remove(req("DELETE"), "thread-01"),
    ]) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "sign_in_required" });
    }
  });

  it("POST creates with a client-supplied id, GET lists newest first", async () => {
    // A stepping clock: without it the three writes share a millisecond.
    let tick = 0;
    const { h, store } = handlers("u1", new MemoryThreadStore({ now: () => new Date(1_700_000_000_000 + tick++ * 1000) }));
    const created = await (await h.create(req("POST", { id: "thread-aaaaaaaa" }))).json();
    expect(created.thread).toMatchObject({ id: "thread-aaaaaaaa", title: null });
    await h.create(req("POST", { id: "thread-bbbbbbbb", title: "  named  thread " }));
    await store.appendMessages("u1", "thread-aaaaaaaa", [user("m1", "who is in heat?")]);

    const listed = await (await h.list(req("GET"))).json();
    expect(listed.threads.map((t: { id: string }) => t.id)).toEqual(["thread-aaaaaaaa", "thread-bbbbbbbb"]);
    expect(listed.threads[0]).toMatchObject({ title: "who is in heat?" });
    expect(listed.threads[1].title).toBe("named thread");
  });

  it("POST rejects an id that is not URL-safe", async () => {
    const { h } = handlers("u1");
    expect((await h.create(req("POST", { id: "not ok!" }))).status).toBe(400);
    expect((await h.create(req("POST", { id: "short" }))).status).toBe(400);
    // No body at all is fine: the server mints the id.
    const res = await h.create(new Request("http://localhost/api/threads", { method: "POST" }));
    expect(res.status).toBe(200);
    expect((await res.json()).thread.id).toBeTruthy();
  });

  it("GET /[id] returns the thread and its messages, 404 for someone else's", async () => {
    const { h, store } = handlers("u1");
    await store.createThread("u1", { id: "thread-aaaaaaaa" });
    await store.appendMessages("u1", "thread-aaaaaaaa", [user("m1", "hello")]);
    await store.createThread("u2", { id: "thread-zzzzzzzz" });

    const body = await (await h.get(req("GET"), "thread-aaaaaaaa")).json();
    expect(body.thread).toMatchObject({ id: "thread-aaaaaaaa", title: "hello" });
    expect(body.messages).toEqual([{ id: "m1", role: "user", parts: [{ type: "text", text: "hello" }] }]);

    for (const id of ["thread-zzzzzzzz", "thread-missing"]) {
      const res = await h.get(req("GET"), id);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    }
  });

  it("PATCH renames; a missing title is a 400 and another user's thread a 404", async () => {
    const { h, store } = handlers("u1");
    await store.createThread("u1", { id: "thread-aaaaaaaa" });
    await store.createThread("u2", { id: "thread-zzzzzzzz" });

    const ok = await h.rename(req("PATCH", { title: "renamed" }), "thread-aaaaaaaa");
    expect((await ok.json()).thread).toMatchObject({ id: "thread-aaaaaaaa", title: "renamed" });
    expect((await h.rename(req("PATCH", { title: "   " }), "thread-aaaaaaaa")).status).toBe(400);
    expect((await h.rename(req("PATCH", {}), "thread-aaaaaaaa")).status).toBe(400);
    expect((await h.rename(req("PATCH", { title: "hijack" }), "thread-zzzzzzzz")).status).toBe(404);
    expect((await store.getThread("u2", "thread-zzzzzzzz"))!.title).toBeNull();
  });

  it("DELETE removes the thread and its messages, and never another user's", async () => {
    const { h, store } = handlers("u1");
    await store.createThread("u1", { id: "thread-aaaaaaaa" });
    await store.appendMessages("u1", "thread-aaaaaaaa", [user("m1", "hello")]);
    await store.createThread("u2", { id: "thread-zzzzzzzz" });

    expect(await (await h.remove(req("DELETE"), "thread-aaaaaaaa")).json()).toEqual({ ok: true });
    expect(await store.getThread("u1", "thread-aaaaaaaa")).toBeNull();
    expect(await store.listMessages("u1", "thread-aaaaaaaa")).toEqual([]);

    // Deleting someone else's is a silent no-op, not a leak.
    expect(await (await h.remove(req("DELETE"), "thread-zzzzzzzz")).json()).toEqual({ ok: true });
    expect(await store.getThread("u2", "thread-zzzzzzzz")).not.toBeNull();
  });
});
