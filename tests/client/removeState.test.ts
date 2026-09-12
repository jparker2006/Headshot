import { describe, it, expect } from "vitest";
import { commitsRemove, nextRemoveState, removeLabel } from "@/components/page/removeState";

describe("remove from log", () => {
  it("asks once before it commits", () => {
    expect(nextRemoveState("idle", "click")).toBe("confirm");
    expect(commitsRemove("idle", "click")).toBe(false);
    expect(nextRemoveState("confirm", "click")).toBe("busy");
    expect(commitsRemove("confirm", "click")).toBe(true);
  });

  it("puts it back when you leave the control", () => {
    expect(nextRemoveState("confirm", "blur")).toBe("idle");
    expect(nextRemoveState("busy", "blur")).toBe("busy");
    expect(nextRemoveState("idle", "blur")).toBe("idle");
  });

  it("never fires a second DELETE while one is in flight", () => {
    expect(nextRemoveState("busy", "click")).toBe("busy");
    expect(commitsRemove("busy", "click")).toBe(false);
  });

  it("lands the request either way", () => {
    expect(nextRemoveState("busy", "done")).toBe("idle");
    expect(nextRemoveState("busy", "fail")).toBe("error");
    // An error is recoverable: the control arms again.
    expect(nextRemoveState("error", "click")).toBe("confirm");
  });

  it("uses board C words", () => {
    expect(removeLabel("idle")).toBe("remove from log");
    expect(removeLabel("confirm")).toBe("remove?");
    expect(removeLabel("busy")).toBe("removing…");
    expect(removeLabel("idle")).toBe(removeLabel("idle").toLowerCase());
  });
});
