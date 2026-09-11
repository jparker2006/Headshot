import { describe, expect, it } from "vitest";
import { shortAgo, threadMetaLine } from "@/components/chat/threadMeta";
import { isSpentLink } from "@/components/auth/linkError";

const now = new Date("2026-09-11T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("the thread header's mono line", () => {
  it("writes time the way a terminal would", () => {
    expect(shortAgo(ago(10_000), now)).toBe("just now");
    expect(shortAgo(ago(12 * 60_000), now)).toBe("12m ago");
    expect(shortAgo(ago(3 * 3_600_000), now)).toBe("3h ago");
    expect(shortAgo(ago(2 * 86_400_000), now)).toBe("2d ago");
  });

  it("falls back to a date past a week, and to nothing at all when it cannot parse", () => {
    expect(shortAgo(ago(40 * 86_400_000), now)).toMatch(/\d/);
    expect(shortAgo("not a date", now)).toBe("");
    expect(shortAgo(null, now)).toBe("");
  });

  it("joins the age and the count, dropping either half when we do not have it", () => {
    expect(threadMetaLine(ago(3 * 3_600_000), 2, now)).toBe("3h ago · 2 messages");
    expect(threadMetaLine(ago(3 * 3_600_000), 1, now)).toBe("3h ago · 1 message");
    expect(threadMetaLine(ago(3 * 3_600_000), 0, now)).toBe("3h ago");
    expect(threadMetaLine(null, 2, now)).toBe("2 messages");
    expect(threadMetaLine(null, 0, now)).toBe("");
  });
});

describe("a spent magic link", () => {
  it("recognises what a verify failure looks like, whatever it is called", () => {
    for (const e of ["invalid_link", "INVALID_TOKEN", "EXPIRED_TOKEN", "token_used"]) expect(isSpentLink(e)).toBe(true);
  });
  it("does not claim a spent link when there is no error at all", () => {
    expect(isSpentLink("")).toBe(false);
    expect(isSpentLink(null)).toBe(false);
    expect(isSpentLink("rate_limited")).toBe(false);
  });
});
