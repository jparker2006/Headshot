import { describe, it, expect, beforeEach } from "vitest";
import { createChatHandler } from "@/app/api/chat/route";
import { MemoryBrain } from "@/lib/brain";
import { resetLimits } from "@/lib/limits";
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
