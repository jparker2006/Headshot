import { describe, it, expect } from "vitest";
import { DECADE_ROWS, PEOPLE_ROW, decadeRows, laterRows, peopleRow } from "@/components/you/youRows";
import type { WatchedRow } from "@/lib/taste/types";

const person = (name: string, count: number) => ({ imdbId: `nm${name}`, name, count, role: "actor" as const, face: null });

const row = (titleImdbId: string, rating: WatchedRow["rating"], updatedAt: string): Pick<WatchedRow, "titleImdbId" | "rating" | "updatedAt"> => ({
  titleImdbId,
  rating,
  updatedAt,
});

describe("the people row", () => {
  it("is one row of twelve", () => {
    expect(PEOPLE_ROW).toBe(12);
    const many = Array.from({ length: 30 }, (_, i) => person(`p${i}`, 30 - i));
    expect(peopleRow(many)).toHaveLength(12);
    expect(peopleRow(many)[0].name).toBe("p0");
  });

  it("keeps the route's ranking rather than re-sorting it", () => {
    const people = [person("a", 8), person("b", 9)];
    expect(peopleRow(people).map((p) => p.name)).toEqual(["a", "b"]);
  });

  it("drops anyone it could not count", () => {
    expect(peopleRow([person("a", 0), person("b", 2)]).map((p) => p.name)).toEqual(["b"]);
  });
});

describe("the decades ledger", () => {
  it("is the six biggest, biggest first", () => {
    expect(DECADE_ROWS).toBe(6);
    const decades = [
      { decade: "1990s", count: 4 },
      { decade: "2010s", count: 22 },
      { decade: "2000s", count: 18 },
      { decade: "1980s", count: 3 },
      { decade: "1970s", count: 2 },
      { decade: "1960s", count: 1 },
      { decade: "1950s", count: 1 },
    ];
    const rows = decadeRows(decades);
    expect(rows).toHaveLength(6);
    expect(rows.map((d) => d.decade)).toEqual(["2010s", "2000s", "1990s", "1980s", "1970s", "1950s"]);
  });

  it("drops empty decades", () => {
    expect(decadeRows([{ decade: "2020s", count: 0 }])).toEqual([]);
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
