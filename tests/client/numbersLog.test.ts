import { describe, expect, it } from "vitest";
import { logDate, matchesLog, posterThumb, type LogFilter } from "@/components/you/numbersRules";
import type { NumbersLogRow } from "@/lib/taste/numbers";

const row = (over: Partial<NumbersLogRow>): NumbersLogRow => ({
  imdbId: "tt0000001",
  name: "Apollo 13",
  year: 1995,
  kind: "movie",
  state: "rated",
  score: 8,
  watchedAt: "2026-09-02T20:00:00.000Z",
  source: "log",
  season: null,
  runtime: 140,
  genres: [],
  posterPath: null,
  ...over,
});

const keep = (r: NumbersLogRow, f: LogFilter, q = "") => matchesLog(r, f, q);

describe("numbers log filter", () => {
  it("splits films from shows", () => {
    expect(keep(row({}), "films")).toBe(true);
    expect(keep(row({}), "shows")).toBe(false);
    expect(keep(row({ kind: "series" }), "shows")).toBe(true);
  });

  it("filters by state, and `rated` means it carries a score", () => {
    const want = row({ state: "want", score: null });
    expect(keep(want, "want")).toBe(true);
    expect(keep(want, "rated")).toBe(false);
    expect(keep(want, "seen")).toBe(false);
    expect(keep(row({ state: "seen", score: null }), "seen")).toBe(true);
    expect(keep(row({}), "rated")).toBe(true);
    expect(keep(row({ state: "seen", score: null }), "all")).toBe(true);
  });

  it("matches the text against name and year, case-insensitively", () => {
    expect(keep(row({}), "all", "apollo")).toBe(true);
    expect(keep(row({}), "all", "1995")).toBe(true);
    expect(keep(row({}), "all", " GUMP ")).toBe(false);
  });

  it("applies the chip and the text together", () => {
    expect(keep(row({ kind: "series", name: "Good Series" }), "shows", "good")).toBe(true);
    expect(keep(row({ kind: "series", name: "Good Series" }), "films", "good")).toBe(false);
  });
});

describe("numbers log cells", () => {
  it("builds a poster thumb only when there is a poster", () => {
    expect(posterThumb("/a.jpg")).toBe("https://image.tmdb.org/t/p/w92/a.jpg");
    expect(posterThumb(null)).toBeNull();
  });

  it("says nothing rather than inventing a date", () => {
    expect(logDate("2026-09-02T20:00:00.000Z")).toBe("2 Sept 2026");
    expect(logDate(null)).toBe("—");
    expect(logDate("not a date")).toBe("—");
  });
});
