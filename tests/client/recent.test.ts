import { describe, it, expect } from "vitest";
import { relativeTime, recentlyLogged, terseTime } from "@/components/you/recent";
import type { WatchedRow } from "@/lib/taste/types";

const NOW = new Date("2026-09-11T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("relativeTime", () => {
  it("reads the last day in prose", () => {
    expect(relativeTime(ago(5_000), NOW)).toBe("just now");
    expect(relativeTime(ago(10 * 60_000), NOW)).toBe("10 minutes ago");
    expect(relativeTime(ago(60 * 60_000), NOW)).toBe("1 hour ago");
    expect(relativeTime(ago(5 * 3600_000), NOW)).toBe("5 hours ago");
  });

  it("reads days and weeks, then falls back to a date", () => {
    expect(relativeTime(ago(26 * 3600_000), NOW)).toBe("yesterday");
    expect(relativeTime(ago(3 * 86_400_000), NOW)).toBe("3 days ago");
    expect(relativeTime(ago(14 * 86_400_000), NOW)).toBe("2 weeks ago");
    expect(relativeTime(ago(120 * 86_400_000), NOW)).toMatch(/\d/);
  });

  it("never shows an invalid date", () => {
    expect(relativeTime(null, NOW)).toBe("");
    expect(relativeTime("not a date", NOW)).toBe("");
    // Clock skew: a stamp in the future is not "-2 minutes ago".
    expect(relativeTime(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe("just now");
  });
});

describe("recentlyLogged", () => {
  const row = (titleImdbId: string, updatedAt: string, rating: WatchedRow["rating"] = "liked"): WatchedRow => ({
    titleImdbId,
    rating,
    watchedAt: null,
    source: "log",
    season: null,
    episodesWatched: 0,
    updatedAt,
  });

  it("is newest first and capped", () => {
    const rows = [row("tt1", "2026-09-01T00:00:00Z"), row("tt2", "2026-09-09T00:00:00Z"), row("tt3", "2026-09-05T00:00:00Z")];
    expect(recentlyLogged(rows).map((r) => r.titleImdbId)).toEqual(["tt2", "tt3", "tt1"]);
    expect(recentlyLogged(rows, 2).map((r) => r.titleImdbId)).toEqual(["tt2", "tt3"]);
  });

  it("keeps every bucket and does not mutate the input", () => {
    const rows = [row("tt1", "2026-09-01T00:00:00Z", "want"), row("tt2", "2026-09-02T00:00:00Z", "meh")];
    expect(recentlyLogged(rows)).toHaveLength(2);
    expect(rows[0].titleImdbId).toBe("tt1");
  });
});

describe("terseTime", () => {
  it("reads as a terminal readout, not a sentence", () => {
    expect(terseTime(ago(5_000), NOW)).toBe("just now");
    expect(terseTime(ago(10 * 60_000), NOW)).toBe("10m ago");
    expect(terseTime(ago(3 * 3600_000), NOW)).toBe("3h ago");
    expect(terseTime(ago(2 * 86_400_000), NOW)).toBe("2d ago");
    expect(terseTime(ago(21 * 86_400_000), NOW)).toBe("3w ago");
    expect(terseTime(ago(800 * 86_400_000), NOW)).toBe("2y ago");
  });

  it("never shows an invalid date", () => {
    expect(terseTime(null, NOW)).toBe("");
    expect(terseTime("not a date", NOW)).toBe("");
    expect(terseTime(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe("just now");
  });
});
