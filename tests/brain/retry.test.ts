import { describe, it, expect } from "vitest";
import { MemoryBrain, resilientBrain, withRetry, isTransient } from "@/lib/brain";

describe("brain retry", () => {
  it("retries transient errors and gives up on others", async () => {
    let calls = 0;
    const v = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error("fetch failed");
      return "ok";
    }, 3, 1);
    expect(v).toBe("ok");
    expect(calls).toBe(3);
    await expect(withRetry(async () => { throw new Error("syntax error"); }, 3, 1)).rejects.toThrow("syntax error");
    expect(isTransient(new Error("Error connecting to database: TypeError: fetch failed"))).toBe(true);
  });

  it("wraps a brain so one transient failure is invisible", async () => {
    const inner = new MemoryBrain();
    let first = true;
    const original = inner.countQuestionsToday.bind(inner);
    inner.countQuestionsToday = async () => {
      if (first) { first = false; throw new Error("ECONNRESET"); }
      return original();
    };
    const brain = resilientBrain(inner);
    await brain.recordQuestion({ text: "q" });
    expect(await brain.countQuestionsToday()).toBe(1);
  });
});
