import { describe, it, expect } from "vitest";
import { numbersSentence } from "@/components/you/numbersRules";

const totals = (over: Partial<{ titles: number; films: number; shows: number; hours: number }> = {}) => ({
  titles: 130,
  films: 113,
  shows: 17,
  hours: 222,
  ...over,
});

describe("numbersSentence", () => {
  it("says the whole of Numbers in one line", () => {
    const line = numbersSentence(totals(), [
      { decade: "2010s", count: 40 },
      { decade: "2000s", count: 44 },
      { decade: "1990s", count: 20 },
    ]);
    expect(line).toBe("130 titles, 222 hours. 113 films, 17 shows. mostly 2000s and 2010s.");
  });

  it("is lowercase, has no exclamation and never shouts", () => {
    const line = numbersSentence(totals(), [{ decade: "1970s", count: 9 }]);
    expect(line).not.toMatch(/!/);
    expect(line.replace(/[^a-z]/gi, "")).toBe(line.replace(/[^a-z]/gi, "").toLowerCase());
  });

  it("says nothing about decades until one is a habit", () => {
    expect(numbersSentence(totals({ titles: 1, films: 1, shows: 0, hours: 2 }), [{ decade: "2010s", count: 1 }])).toBe("1 title, 2 hours. 1 film.");
  });

  it("names one decade when only one is a habit", () => {
    expect(
      numbersSentence(totals({ titles: 12, films: 12, shows: 0, hours: 20 }), [
        { decade: "2010s", count: 8 },
        { decade: "1990s", count: 1 },
      ]),
    ).toBe("12 titles, 20 hours. 12 films. mostly 2010s.");
  });

  it("drops the half of the kinds that is empty", () => {
    expect(numbersSentence(totals({ titles: 17, films: 0, shows: 17, hours: 60 }), [])).toBe("17 titles, 60 hours. 17 shows.");
  });

  it("leaves hours out when nothing has a runtime yet", () => {
    expect(numbersSentence(totals({ titles: 3, films: 3, shows: 0, hours: 0 }), [])).toBe("3 titles. 3 films.");
  });

  it("says so when there is nothing", () => {
    expect(numbersSentence(totals({ titles: 0, films: 0, shows: 0, hours: 0 }), [])).toBe("nothing logged yet.");
  });

  it("ranks decades itself rather than trusting the order it is given", () => {
    const line = numbersSentence(totals(), [
      { decade: "1990s", count: 2 },
      { decade: "2020s", count: 30 },
      { decade: "1980s", count: 25 },
    ]);
    expect(line.endsWith("mostly 2020s and 1980s.")).toBe(true);
  });
});
