import { describe, expect, it } from "vitest";
import {
  CLAIM_EVIDENCE,
  CLAIM_WORDS,
  claimInk,
  claimTag,
  orderEvidence,
  truncateClaim,
  visibleClaims,
  type Claim,
} from "@/components/you/claimRows";

const claim = (over: Partial<Claim> = {}): Claim => ({
  id: "c1",
  text: "crime with a long fuse",
  evidence: ["tt1"],
  polarity: "love",
  ...over,
});

describe("orderEvidence", () => {
  it("puts the best-scored proof first", () => {
    const ids = orderEvidence(["tt1", "tt2", "tt3"], { tt1: 7, tt2: 9.9, tt3: 8 });
    expect(ids).toEqual(["tt2", "tt3", "tt1"]);
  });

  it("keeps the rewrite's order for a tie", () => {
    expect(orderEvidence(["tt1", "tt2"], { tt1: 8, tt2: 8 })).toEqual(["tt1", "tt2"]);
  });

  it("sorts a row with no score last rather than to the top", () => {
    expect(orderEvidence(["nm1", "tt2"], { tt2: 6 })).toEqual(["tt2", "nm1"]);
    expect(orderEvidence(["tt1", "tt2"], {})).toEqual(["tt1", "tt2"]);
  });

  it("never draws more than five marks", () => {
    expect(CLAIM_EVIDENCE).toBe(5);
    const ids = ["tt1", "tt2", "tt3", "tt4", "tt5", "tt6", "tt7"];
    expect(orderEvidence(ids, {})).toEqual(ids.slice(0, 5));
    expect(orderEvidence(ids, {}, 3)).toHaveLength(3);
    expect(orderEvidence(ids, {}, 0)).toEqual([]);
  });
});

describe("claim tag and ink", () => {
  it("says avoid, and says nothing for a love", () => {
    expect(claimTag("avoid")).toBe("avoid");
    expect(claimTag("love")).toBeNull();
  });

  it("reads loud for a love and quiet for an avoid", () => {
    expect(claimInk("love")).toBe("text-ink");
    expect(claimInk("avoid")).toBe("text-ink-dim");
  });
});

describe("truncateClaim", () => {
  it("leaves a claim inside the cap alone", () => {
    expect(truncateClaim("crime with a long fuse")).toBe("crime with a long fuse");
  });

  it("cuts at twelve words", () => {
    expect(CLAIM_WORDS).toBe(12);
    const long = Array.from({ length: 15 }, (_, i) => `w${i + 1}`).join(" ");
    expect(truncateClaim(long)).toBe("w1 w2 w3 w4 w5 w6 w7 w8 w9 w10 w11 w12…");
  });

  it("normalises whitespace and honours a tighter cap", () => {
    expect(truncateClaim("  slow   burns  ")).toBe("slow burns");
    expect(truncateClaim("one two three", 2)).toBe("one two…");
  });
});

describe("visibleClaims", () => {
  it("drops what the user just rejected", () => {
    const claims = [claim(), claim({ id: "c2" })];
    expect(visibleClaims(claims, ["c2"]).map((c) => c.id)).toEqual(["c1"]);
  });

  it("drops a claim with no evidence and a claim with no text", () => {
    expect(visibleClaims([claim({ id: "c2", evidence: [] }), claim({ id: "c3", text: "  " })])).toEqual([]);
  });

  it("is empty when there is no memory yet", () => {
    expect(visibleClaims(null)).toEqual([]);
    expect(visibleClaims(undefined)).toEqual([]);
  });
});
