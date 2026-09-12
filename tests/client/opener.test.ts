import { describe, expect, it } from "vitest";
import { openerCopy, openerMetaLine, openerPlay } from "@/components/chat/opener";
import type { PickView } from "@/lib/picks/view";

const pick = (over: Partial<PickView> = {}): PickView => ({
  imdbId: "tt1345836",
  name: "The Dark Knight Rises",
  year: 2012,
  titleType: "movie",
  kind: "start",
  reason: { text: "it makes it 8 for Christopher Nolan", viaImdbIds: ["nm0634240"] },
  playLabel: "Play on HBO Max",
  playUrl: "https://www.themoviedb.org/movie/49026/watch",
  onYourServices: true,
  providerNames: ["HBO Max"],
  posterUrl: "/poster.jpg",
  ...over,
});

describe("the mono line under the opener", () => {
  it("is year · kind · the service · whether it is already paid for", () => {
    expect(openerMetaLine(pick())).toBe("2012 · film · hbo max · already paid for");
  });

  it("calls a series a show, and a TV movie a film", () => {
    expect(openerMetaLine(pick({ titleType: "tvSeries" }))).toContain("· show ·");
    expect(openerMetaLine(pick({ titleType: "tvMovie" }))).toContain("· film ·");
  });

  it("drops every half it does not have rather than writing a blank", () => {
    expect(openerMetaLine(pick({ year: 0, providerNames: [], onYourServices: false }))).toBe("film");
    expect(openerMetaLine(pick({ onYourServices: false }))).toBe("2012 · film · hbo max");
  });
});

describe("the one playable thing under the opener", () => {
  it("is the accent when the server named a service", () => {
    expect(openerPlay(pick())).toEqual({ label: "Play on HBO Max", url: "https://www.themoviedb.org/movie/49026/watch", accent: true });
  });

  it("falls back to a quiet 'Where to watch' when there is no label", () => {
    expect(openerPlay(pick({ playLabel: null }))).toMatchObject({ label: "Where to watch", accent: false });
  });

  it("is nothing at all when there is nowhere to send you", () => {
    expect(openerPlay(pick({ playUrl: null }))).toBeNull();
  });
});

describe("what the empty column says when there is no pick", () => {
  it("is one line, first person, never a spinner", () => {
    expect(openerCopy("loading")).toBe("finding one for tonight…");
    expect(openerCopy("none")).toBe("log a few things and I'll have one for tonight.");
    expect(openerCopy("signed-out")).toBe("ask me who was in what. sign in and I'll know what you've seen.");
  });
});
