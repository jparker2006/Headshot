import { describe, it, expect } from "vitest";
import { factsLine } from "@/components/page/facts";

const title = {
  kind: "title" as const,
  year: 1995,
  titleType: "movie",
  genres: "Crime,Drama,Action",
  degree: 41,
};
const person = {
  kind: "person" as const,
  year: 0,
  titleType: "",
  genres: "",
  degree: 121,
};

describe("the drawer's mono facts line", () => {
  it("writes a film the way the Log board's picked header does", () => {
    expect(factsLine({ ...title, runtime: 170, tmdbGenres: ["Crime", "Drama"] })).toEqual(["1995", "film", "170m", "crime, drama"]);
  });

  it("names the service you pay for, lowercase, at the end", () => {
    expect(factsLine({ ...title, runtime: 165, onService: "HBO Max" }).at(-1)).toBe("hbo max");
    // Nothing you pay for: the line just stops.
    expect(factsLine({ ...title, runtime: 165, onService: null }).at(-1)).toBe("crime, drama");
  });

  it("calls a show a show, by seasons or by title type, and counts seasons instead of minutes", () => {
    expect(factsLine({ ...title, year: 2008, seasons: 5, runtime: 47 })).toEqual(["2008", "show", "5 seasons", "crime, drama"]);
    expect(factsLine({ ...title, year: 2016, titleType: "tvSeries" })[1]).toBe("show");
    expect(factsLine({ ...title, year: 2016, seasons: 1 })[2]).toBe("1 season");
  });

  it("keeps at most two genres and prefers TMDB's over the graph's", () => {
    expect(factsLine({ ...title, runtime: 170 }).at(-1)).toBe("crime, drama");
    expect(factsLine({ ...title, runtime: 170, tmdbGenres: ["Science Fiction", "Thriller", "Action"] }).at(-1)).toBe("science fiction, thriller");
  });

  it("writes a person as years, department and credits — never a runtime", () => {
    expect(factsLine({ ...person, birthday: "1943-08-17", knownForDepartment: "Acting" })).toEqual(["born 1943", "acting", "121 credits"]);
    expect(factsLine({ ...person, birthday: "1932-04-01", deathday: "2016-11-10" })).toEqual(["born 1932", "died 2016", "121 credits"]);
  });

  it("drops what it does not know rather than writing a blank", () => {
    expect(factsLine({ ...title, year: 0, genres: "" })).toEqual(["film"]);
    expect(factsLine({ ...person, degree: 0 })).toEqual([]);
  });
});
