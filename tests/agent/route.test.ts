import { describe, it, expect, beforeEach } from "vitest";
import { createChatHandler } from "@/app/api/chat/route";
import { MemoryBrain } from "@/lib/brain";
import { resetLimits } from "@/lib/limits";
import { MemoryThreadStore } from "@/lib/threads/memory";
import { fixtureGraph, scriptedModel, userMessage } from "./helpers";

const BACON = "nm0000001";
const SINISE = "nm0000004";

function handler(brain: MemoryBrain, steps = 1) {
  const scripts = Array.from({ length: steps }, () =>
    scriptedModel([
      { tool: "shortest_path", input: { from: BACON, to: SINISE } },
      { tool: "highlight_path", input: { from: BACON, to: SINISE, tier: "full", index: 0, reason: "only one" } },
      { text: "Bacon number 1." },
    ]),
  );
  let i = 0;
  return createChatHandler({
    model: () => scripts[i++ % scripts.length],
    graph: fixtureGraph,
    brain: async () => brain,
    tmdb: () => null,
    session: async () => ({ id: "session-1", setCookie: true }),
  });
}

function post(body: unknown, ip = "1.2.3.4") {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat (route seam)", () => {
  beforeEach(() => {
    resetLimits();
    delete process.env.HEADSHOT_DAILY_QUESTION_CAP;
    delete process.env.HEADSHOT_PER_IP_PER_MINUTE;
  });

  it("streams the agent's answer as a UI message stream with canvas events and sets a session cookie", async () => {
    const brain = new MemoryBrain();
    const res = await handler(brain)(post({ messages: [userMessage("Bacon to Sinise?")] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("set-cookie")).toContain("headshot_session=session-1");
    const body = await res.text();
    expect(body).toContain('"type":"data-paths"');
    expect(body).toContain('"baconNumber":1');
    expect(body).toContain('"type":"data-path-hop"');
    expect(body).toContain("Bacon number 1.");
    expect(await brain.countQuestionsToday()).toBe(1);
  });

  it("rejects bad input", async () => {
    const h = handler(new MemoryBrain());
    expect((await h(post({}))).status).toBe(400);
    expect((await h(new Request("http://localhost/api/chat", { method: "POST", body: "nope" }))).status).toBe(400);
  });

  it("enforces the per-IP rate limit", async () => {
    process.env.HEADSHOT_PER_IP_PER_MINUTE = "2";
    const h = handler(new MemoryBrain(), 3);
    expect((await h(post({ messages: [userMessage("a")] }))).status).toBe(200);
    expect((await h(post({ messages: [userMessage("b")] }))).status).toBe(200);
    const third = await h(post({ messages: [userMessage("c")] }));
    expect(third.status).toBe(429);
    expect(await third.json()).toMatchObject({ error: "rate_limited", resting: true });
    // A different IP is unaffected.
    expect((await h(post({ messages: [userMessage("d")] }, "9.9.9.9"))).status).toBe(200);
  });

  it("enforces the global daily cap and keeps counting per brain", async () => {
    process.env.HEADSHOT_DAILY_QUESTION_CAP = "1";
    const brain = new MemoryBrain();
    const h = handler(brain, 2);
    expect((await h(post({ messages: [userMessage("a")] }))).status).toBe(200);
    const second = await h(post({ messages: [userMessage("b")] }, "5.5.5.5"));
    expect(second.status).toBe(429);
    expect(await second.json()).toMatchObject({ error: "daily_cap", resting: true });
    expect(await brain.countQuestionsToday()).toBe(1);
  });
});

describe("POST /api/chat thread persistence (v5)", () => {
  const THREAD = "thread-aaaaaaaa";

  /** The handler with a scripted one-step answer, a thread store, and an optional user. */
  function chat(threads: MemoryThreadStore, userId: string | null) {
    const scheduled: Promise<void>[] = [];
    const handler = createChatHandler({
      model: () => scriptedModel([{ text: "two hops, honestly a cute one." }]),
      graph: fixtureGraph,
      brain: async () => new MemoryBrain(),
      tmdb: () => null,
      session: async () => ({ id: "session-1", setCookie: false }),
      followups: false,
      userId: async () => userId,
      threads: async () => threads,
      schedule: (work) => scheduled.push(work()),
    });
    return { handler, settle: () => Promise.all(scheduled) };
  }

  beforeEach(() => {
    resetLimits();
  });

  it("stores both sides of a signed-in turn and titles the thread", async () => {
    const threads = new MemoryThreadStore();
    const { handler, settle } = chat(threads, "u1");
    const res = await handler(post({ messages: [userMessage("how is tom hanks connected to gary sinise?")], threadId: THREAD }));
    expect(res.status).toBe(200);
    await res.text();
    await settle();

    const listed = await threads.listThreads("u1");
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: THREAD, title: "how is tom hanks connected to gary sinise?" });

    const stored = await threads.listMessages("u1", THREAD);
    expect(stored.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(JSON.stringify(stored[1].parts)).toContain("two hops");
  });

  it("stores nothing for a signed-out request, even with a threadId", async () => {
    const threads = new MemoryThreadStore();
    const { handler, settle } = chat(threads, null);
    await (await handler(post({ messages: [userMessage("who was in both?")], threadId: THREAD }))).text();
    await settle();
    expect(await threads.listThreads("u1")).toEqual([]);
    expect(await threads.getThread("u1", THREAD)).toBeNull();
  });

  it("stores nothing when the signed-in request carries no (or an invalid) threadId", async () => {
    const threads = new MemoryThreadStore();
    const { handler, settle } = chat(threads, "u1");
    await (await handler(post({ messages: [userMessage("a")] }))).text();
    await (await handler(post({ messages: [userMessage("b")] }, "2.2.2.2"))).text();
    await settle();
    expect(await threads.listThreads("u1")).toEqual([]);

    const bad = chat(threads, "u1");
    await (await bad.handler(post({ messages: [userMessage("c")] }, "3.3.3.3"))).text();
    await bad.settle();
    expect(await threads.listThreads("u1")).toEqual([]);
  });

  it("appends to an existing thread rather than creating a second one", async () => {
    const threads = new MemoryThreadStore();
    await threads.createThread("u1", { id: THREAD, title: "kept" });
    const ask = (id: string, text: string) => ({ ...userMessage(text), id });
    const first = chat(threads, "u1");
    await (await first.handler(post({ messages: [ask("q1", "first question")], threadId: THREAD }))).text();
    await first.settle();
    const second = chat(threads, "u1");
    await (await second.handler(post({ messages: [ask("q1", "first question"), ask("q2", "second question")], threadId: THREAD }, "4.4.4.4"))).text();
    await second.settle();

    expect(await threads.listThreads("u1")).toHaveLength(1);
    expect((await threads.getThread("u1", THREAD))!.title).toBe("kept");
    expect((await threads.listMessages("u1", THREAD)).map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
  });
});
