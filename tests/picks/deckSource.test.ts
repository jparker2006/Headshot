import { describe, it, expect } from "vitest";
import { deckSource, parseDeckSize, DEFAULT_DECK_SIZE, MAX_DECK_SIZE } from "@/lib/picks/deckSource";
import { onboardingDeck } from "@/lib/picks/onboarding";
import type { WatchedRow } from "@/lib/picks/engine";
import { fixtureGraph } from "../agent/helpers";

const APOLLO = "tt0000001"; // 1995 movie: Gary Sinise, Tom Hanks, Bill Paxton, Kevin Bacon, Wes Director
const GUMP = "tt0000002"; // 1994 movie, 2M votes: Gary Sinise, Tom Hanks, Jane Doe, Ava Writer
const MINI = "tt0000006"; // 2010 mini-series, 20k votes: Gary Sinise, Ava Writer
const GOOD_SERIES = "tt0000009"; // 2018 series, 10k votes: Jane Doe, Bill Paxton
const TALK_SHOW = "tt0000003"; // 2001 talk show: never dealt
const LONG_RUNNER = "tt0000004"; // 1990 series, 3k votes: Bill Paxton, Gus Guest
const TV_MOVIE = "tt0000011"; // 2008 TV movie, 2k votes: Wes Director, Gus Guest

const liked = (imdbId: string): WatchedRow => ({ imdbId, rating: "liked" });

describe("deck source: cold start", () => {
  it("falls back to the onboarding deck below five liked titles, and says so", async () => {
    const graph = await fixtureGraph();
    const watched = [liked(APOLLO), liked(GUMP)];
    const res = deckSource(graph, watched, { size: 6 });
    expect(res.mode).toBe("cold");
    expect(res.cards).toEqual(onboardingDeck(graph, { size: 6, exclude: [APOLLO, GUMP] }));
    // Even cold, nothing already rated comes back.
    expect(res.cards.map((c) => c.imdbId)).not.toContain(APOLLO);
    expect(res.cards.map((c) => c.imdbId)).not.toContain(GUMP);
  });

  it("is lore once the walk has something to walk from", async () => {
    const graph = await fixtureGraph();
    const watched = [APOLLO, GUMP, MINI, GOOD_SERIES, LONG_RUNNER].map(liked);
    expect(deckSource(graph, watched, { size: 6 }).mode).toBe("lore");
  });
});

describe("deck source: lore", () => {
  it("ranks liked-people neighbours above the decade fill and interleaves them 2:1", async () => {
    const graph = await fixtureGraph();
    // Liked Good Series (2018, Jane Doe + Bill Paxton).
    //   (a) their other titles by shared count, then votes: Gump (2M), Apollo (300k), Long Runner (3k).
    //   (b) strongest decade is the 2010s, whose only other title is Mini Series —
    //       reachable from neither of those people, so it can only be the fill.
    const res = deckSource(graph, [liked(GOOD_SERIES)], { size: 10, minLiked: 1 });
    expect(res.mode).toBe("lore");
    expect(res.cards.map((c) => c.imdbId)).toEqual([GUMP, APOLLO, MINI, LONG_RUNNER]);
    // Two from the walk, then one from the decade fill.
    expect(res.cards[2].imdbId).toBe(MINI);
    // A card carries what the client shows: the year and film-vs-show.
    expect(res.cards[0]).toMatchObject({ imdbId: GUMP, name: "Forrest Gump", year: 1994, kind: "film" });
    expect(res.cards[2]).toMatchObject({ imdbId: MINI, kind: "show" });
    // Deterministic.
    expect(deckSource(graph, [liked(GOOD_SERIES)], { size: 10, minLiked: 1 })).toEqual(res);
  });

  it("excludes every rated title whatever the bucket, and the liked title itself", async () => {
    const graph = await fixtureGraph();
    const watched: WatchedRow[] = [
      liked(GOOD_SERIES),
      { imdbId: GUMP, rating: "seen" },
      { imdbId: APOLLO, rating: "meh" },
      { imdbId: LONG_RUNNER, rating: "want" },
      { imdbId: TV_MOVIE, rating: "unseen" },
    ];
    const ids = deckSource(graph, watched, { size: 30, minLiked: 1 }).cards.map((c) => c.imdbId);
    for (const rated of [GOOD_SERIES, GUMP, APOLLO, LONG_RUNNER, TV_MOVIE]) expect(ids).not.toContain(rated);
    // What is left in the fixture is the mini-series; the talk show is never dealt.
    expect(ids).toEqual([MINI]);
    expect(ids).not.toContain(TALK_SHOW);
  });

  it("honours the requested size", async () => {
    const graph = await fixtureGraph();
    expect(deckSource(graph, [liked(GOOD_SERIES)], { size: 2, minLiked: 1 }).cards).toHaveLength(2);
  });
});

describe("deck size", () => {
  it("defaults to thirty, caps at fifty, and ignores junk", () => {
    expect(parseDeckSize(null)).toBe(DEFAULT_DECK_SIZE);
    expect(parseDeckSize("")).toBe(DEFAULT_DECK_SIZE);
    expect(parseDeckSize("abc")).toBe(DEFAULT_DECK_SIZE);
    expect(parseDeckSize("0")).toBe(DEFAULT_DECK_SIZE);
    expect(parseDeckSize("-5")).toBe(DEFAULT_DECK_SIZE);
    expect(parseDeckSize("12")).toBe(12);
    expect(parseDeckSize("12.7")).toBe(12);
    expect(parseDeckSize("999")).toBe(MAX_DECK_SIZE);
  });
});
