import { describe, it, expect } from "vitest";
import { cleanProviderName, toPickView } from "@/lib/picks/view";
import type { Pick } from "@/lib/picks/engine";
import type { CandidateMeta } from "@/lib/picks/candidates";

const pick: Pick = {
  imdbId: "tt1",
  name: "Heat",
  year: 1995,
  titleType: "movie",
  kind: "start",
  score: 1,
  reason: { text: "r", viaImdbIds: [], kind: "shared-people" },
  availableOn: [8, 1899],
  onYourServices: true,
  rentPrice: null,
};
const meta: CandidateMeta = {
  imdbId: "tt1",
  link: "https://www.themoviedb.org/movie/949/watch?locale=US",
  providers: [
    { id: 8, name: "Netflix" },
    { id: 1899, name: "Max" },
  ],
};

describe("pick view", () => {
  it("Play is TMDB's provider link, whatever service it is on", () => {
    const v = toPickView(pick, meta, [1899]);
    expect(v.playUrl).toBe(meta.link);
    expect(v.playLabel).toBe("Play on Max");
    // Not on your services: same link, different label.
    const rent = toPickView({ ...pick, onYourServices: false, availableOn: [], rentPrice: "rent" }, meta, [15]);
    expect(rent.playUrl).toBe(meta.link);
    expect(rent.playLabel).toBe("Rent");
  });

  it("no provider link from TMDB means no Play url", () => {
    const bare: CandidateMeta = { imdbId: "tt1", providers: [{ id: 1899, name: "Max" }] };
    const v = toPickView(pick, bare, [1899]);
    expect(v.playUrl).toBeNull();
    expect(v.playLabel).toBe("Play on Max"); // the label still knows the service
    const unknown = toPickView({ ...pick, onYourServices: false, availableOn: [] }, undefined, [1899]);
    expect(unknown.playUrl).toBeNull();
    expect(unknown.playLabel).toBeNull();
  });

  it("'Where to watch' when TMDB has a link but nothing of yours carries it", () => {
    const v = toPickView({ ...pick, onYourServices: false, availableOn: [] }, meta, [15]);
    expect(v.playLabel).toBe("Where to watch");
    expect(v.playUrl).toBe(meta.link);
  });

  // SPEC v5.1: TMDB names the reseller; the user calls it HBO Max.
  it("cleans reseller suffixes off provider names, in the label and the list", () => {
    expect(cleanProviderName("HBO Max Amazon Channel")).toBe("HBO Max");
    expect(cleanProviderName("Paramount+ Apple TV Channel")).toBe("Paramount+");
    expect(cleanProviderName("Paramount+ with Ads")).toBe("Paramount+");
    expect(cleanProviderName("AMC+ Roku Premium Channel")).toBe("AMC+");
    expect(cleanProviderName("Netflix")).toBe("Netflix");

    const view = toPickView(pick, { ...meta, providers: [{ id: 8, name: "HBO Max Amazon Channel" }, { id: 1899, name: "HBO Max" }] }, [8]);
    expect(view.playLabel).toBe("Play on HBO Max");
    expect(view.providerNames).toEqual(["HBO Max"]);
  });
});
