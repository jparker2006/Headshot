import { describe, it, expect } from "vitest";
import { serviceDeepLink } from "@/lib/picks/deeplink";
import { toPickView } from "@/lib/picks/view";

describe("Play deep links", () => {
  it("lands on the service's own search for the title", () => {
    expect(serviceDeepLink(8, "Heat", 1995)).toBe("https://www.netflix.com/search?q=Heat");
    expect(serviceDeepLink(1899, "Dune: Part Two")).toBe("https://play.max.com/search?q=Dune%3A%20Part%20Two");
    expect(serviceDeepLink(531, "Yellowstone")).toContain("paramountplus.com");
    expect(serviceDeepLink(192, "Heat", 1995)).toContain("Heat%201995");
    expect(serviceDeepLink(999999, "X")).toBeNull();
  });

  it("a pick's Play goes to the first of the user's services, else where-to-watch", () => {
    const pick = { imdbId: "tt1", name: "Heat", year: 1995, titleType: "movie", kind: "start" as const, score: 1, reason: { text: "r", viaImdbIds: [], kind: "shared-people" as const }, availableOn: [8, 1899], onYourServices: true, rentPrice: null };
    const meta = { imdbId: "tt1", link: "https://www.themoviedb.org/movie/949/watch", providers: [{ id: 8, name: "Netflix" }, { id: 1899, name: "Max" }] };
    const v = toPickView(pick, meta, [1899]);
    expect(v.playLabel).toBe("Play on Max");
    expect(v.playUrl).toBe("https://play.max.com/search?q=Heat");
    const none = toPickView({ ...pick, onYourServices: false, availableOn: [] }, meta, [15]);
    expect(none.playUrl).toBe(meta.link);
  });
});
