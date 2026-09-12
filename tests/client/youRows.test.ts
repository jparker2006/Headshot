import { describe, it, expect } from "vitest";
import { RIGHT_NOW_ROWS, laterRows, rightNowRows } from "@/components/you/youRows";
import type { WatchedRow } from "@/lib/taste/types";

const row = (titleImdbId: string, rating: WatchedRow["rating"], updatedAt: string): Pick<WatchedRow, "titleImdbId" | "rating" | "updatedAt"> => ({
  titleImdbId,
  rating,
  updatedAt,
});

const series = (
  titleImdbId: string,
  rating: WatchedRow["rating"],
  season: number | null,
  updatedAt: string,
): Pick<WatchedRow, "titleImdbId" | "rating" | "season" | "updatedAt"> => ({ titleImdbId, rating, season, updatedAt });

describe("right now", () => {
  it("is the series with a season marked, most recently touched first", () => {
    const rows = [
      series("tt1", "rated", 2, "2026-01-01T00:00:00.000Z"),
      series("tt2", "seen", 1, "2026-03-01T00:00:00.000Z"),
      series("tt3", "rated", null, "2026-04-01T00:00:00.000Z"),
    ];
    expect(rightNowRows(rows).map((r) => r.titleImdbId)).toEqual(["tt2", "tt1"]);
  });

  it("is not Later and not a removal", () => {
    const rows = [series("tt1", "want", 1, "2026-05-01T00:00:00.000Z"), series("tt2", "unseen", 1, "2026-05-02T00:00:00.000Z")];
    expect(rightNowRows(rows)).toEqual([]);
  });

  it("is six at most", () => {
    expect(RIGHT_NOW_ROWS).toBe(6);
    const rows = Array.from({ length: 9 }, (_, i) => series(`tt${i}`, "rated", 1, `2026-01-0${(i % 9) + 1}T00:00:00.000Z`));
    expect(rightNowRows(rows)).toHaveLength(6);
  });
});

describe("later", () => {
  it("is the want rows, newest first", () => {
    const rows = [
      row("tt1", "want", "2026-01-01T00:00:00.000Z"),
      row("tt2", "rated", "2026-03-01T00:00:00.000Z"),
      row("tt3", "want", "2026-02-01T00:00:00.000Z"),
      row("tt4", "seen", "2026-04-01T00:00:00.000Z"),
    ];
    expect(laterRows(rows).map((r) => r.titleImdbId)).toEqual(["tt3", "tt1"]);
  });

  it("sorts a row with no timestamp last rather than to the top", () => {
    const rows = [row("tt1", "want", ""), row("tt2", "want", "2026-02-01T00:00:00.000Z")];
    expect(laterRows(rows).map((r) => r.titleImdbId)).toEqual(["tt2", "tt1"]);
  });
});
