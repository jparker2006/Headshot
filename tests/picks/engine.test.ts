import { describe, it, expect } from "vitest";
import { cosine, graphReason, pickTonight, tasteFacts, walkCandidates, type Candidate, type WatchedRow } from "@/lib/picks/engine";
import { fixtureGraph } from "../agent/helpers";

const APOLLO = "tt0000001";
const GUMP = "tt0000002";
const LATE_NIGHT = "tt0000003";
const LONG_RUNNER = "tt0000004";
const INDIE = "tt0000005";
const MINI = "tt0000006";
const GOOD_SERIES = "tt0000009";
const HULU = 15;
const MAX = 1899;

const cand = (imdbId: string, extra: Partial<Candidate> = {}): Candidate => ({ imdbId, availableOn: [HULU], ...extra });

describe("pick engine (pure)", () => {
  it("cosine is 1 for identical, 0 for orthogonal, 0 for empty", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([], [])).toBe(0);
  });

  it("the reason rule: a real shared-people fact or nothing", async () => {
    const graph = await fixtureGraph();
    const liked = new Set([graph.idOf(APOLLO)!]);
    const gump = graphReason(graph, graph.idOf(GUMP)!, liked);
    expect(gump?.kind).toBe("shared-people");
    expect(gump?.text).toMatch(/^(Tom Hanks and Gary Sinise|Gary Sinise and Tom Hanks), both in Apollo 13 which you liked$/);
    expect(gump?.viaImdbIds).toEqual(expect.arrayContaining(["nm0000002", "nm0000004", APOLLO]));
    // Mini Series (Gary Sinise, Ava Writer) shares nobody with Good Series (Jane Doe, Bill Paxton).
    expect(graphReason(graph, graph.idOf(MINI)!, new Set([graph.idOf(GOOD_SERIES)!]))).toBeNull();
  });

  it("'your nth' when one person spans two liked titles", async () => {
    const graph = await fixtureGraph();
    const liked = new Set([graph.idOf(APOLLO)!, graph.idOf(GUMP)!]);
    // Mini Series has Gary Sinise, who is in both liked films.
    const r = graphReason(graph, graph.idOf(MINI)!, liked);
    expect(r?.kind).toBe("your-nth");
    expect(r?.text).toMatch(/^your 3rd Gary Sinise, after (Apollo 13 and Forrest Gump|Forrest Gump and Apollo 13)$/);
  });

  it("walks the graph for unseen candidates ranked by shared people", async () => {
    const graph = await fixtureGraph();
    const watched: WatchedRow[] = [{ imdbId: APOLLO, rating: "rated", score: 8 }];
    const out = walkCandidates(graph, watched);
    expect(out.map((c) => c.imdbId)).not.toContain(APOLLO);
    // A Later title is a candidate even with no graph link, so the list drains.
    const withLater = walkCandidates(graph, [{ imdbId: GOOD_SERIES, rating: "rated", score: 8 }, { imdbId: MINI, rating: "want", score: null }]);
    expect(withLater.find((c) => c.imdbId === MINI)?.proximity).toBeGreaterThanOrEqual(0.5); // no shared people with Good Series, still a candidate
    expect(out[0].imdbId).toBe(GUMP); // Hanks + Sinise, strong tier
    expect(out.find((c) => c.imdbId === LATE_NIGHT)!.proximity).toBeLessThan(out[0].proximity); // weak tier counts half
  });

  it("picks three with reasons, at most one continue, available-first, rent price kept for the rest", async () => {
    const graph = await fixtureGraph();
    const watched: WatchedRow[] = [
      { imdbId: APOLLO, rating: "rated", score: 8 },
      { imdbId: GOOD_SERIES, rating: "rated", score: 8, season: 2, episodesWatched: 3 },
    ];
    const r = pickTonight({
      graph,
      watched,
      services: [HULU],
      candidates: [cand(GUMP), cand(MINI, { availableOn: [MAX], rentPrice: "3.99" }), cand(LATE_NIGHT), cand(INDIE), cand(GOOD_SERIES), cand(LONG_RUNNER)],
    });
    expect(r.picks).toHaveLength(3);
    expect(r.picks[0].kind).toBe("continue");
    expect(r.picks[0].imdbId).toBe(GOOD_SERIES);
    expect(r.picks[0].reason.text).toBe("one more. you're on season 2, 3 episodes in");
    expect(r.picks[0].progress).toEqual({ season: 2, episodesWatched: 3 });
    const starts = r.picks.filter((p) => p.kind === "start");
    expect(starts.map((p) => p.imdbId)).toContain(GUMP);
    expect(starts.every((p) => p.reason.text.length > 0)).toBe(true);
    // Tiny Indie shares nobody with Apollo 13 (and may sit under the fixture's vote floor): rejected either way.
    expect(r.rejected.find((x) => x.imdbId === INDIE)).toBeTruthy();
    expect([...r.picks, ...r.deck].map((p) => p.imdbId)).not.toContain(INDIE);
    // Mini Series is on Max, which the user does not have: ranked below Gump and carrying the rent price.
    const mini = [...r.picks, ...r.deck].find((p) => p.imdbId === MINI)!;
    expect(mini.onYourServices).toBe(false);
    expect(mini.rentPrice).toBe("3.99");
    const gump = [...r.picks, ...r.deck].find((p) => p.imdbId === GUMP)!;
    expect(gump.score).toBeGreaterThan(mini.score);
    expect(gump.rentPrice).toBeNull();
  });

  it("never re-picks dismissed or seen titles and honours runtime and energy filters", async () => {
    const graph = await fixtureGraph();
    const watched: WatchedRow[] = [{ imdbId: APOLLO, rating: "rated", score: 8 }, { imdbId: MINI, rating: "rated", score: 5 }];
    const r = pickTonight({
      graph,
      watched,
      services: [HULU],
      dismissed: [GUMP],
      candidates: [cand(GUMP), cand(MINI), cand(LATE_NIGHT, { runtimeMin: 60 }), cand(LONG_RUNNER, { runtimeMin: 45 })],
      filters: { maxRuntimeMin: 50, energy: "light" },
    });
    const ids = [...r.picks, ...r.deck].map((p) => p.imdbId);
    expect(ids).not.toContain(GUMP);
    expect(ids).not.toContain(MINI);
    expect(ids).not.toContain(LATE_NIGHT); // too long
    expect(r.rejected).toContainEqual({ imdbId: GUMP, why: "dismissed" });
    expect(r.rejected).toContainEqual({ imdbId: LATE_NIGHT, why: "too long" });
    expect(r.rejected).toContainEqual({ imdbId: LONG_RUNNER, why: "wrong energy" }); // Drama only, light asked
  });

  it("an imported `seen` title is watched: never walked, never picked, never dealt", async () => {
    const graph = await fixtureGraph();
    // Netflix import: Forrest Gump was watched, with no opinion attached.
    const watched: WatchedRow[] = [{ imdbId: APOLLO, rating: "rated", score: 8 }, { imdbId: GUMP, rating: "seen", score: null }];
    expect(walkCandidates(graph, watched).map((c) => c.imdbId)).not.toContain(GUMP);
    const r = pickTonight({
      graph,
      watched,
      services: [HULU],
      candidates: [cand(GUMP), cand(MINI), cand(LATE_NIGHT)],
    });
    expect([...r.picks, ...r.deck].map((p) => p.imdbId)).not.toContain(GUMP);
    // `seen` is not a like: it never becomes the reason for another pick.
    expect([...r.picks, ...r.deck].every((p) => !p.reason.viaImdbIds.includes(GUMP))).toBe(true);
  });

  it("the taste vector moves the ranking when candidates carry vectors", async () => {
    const graph = await fixtureGraph();
    const watched: WatchedRow[] = [{ imdbId: APOLLO, rating: "rated", score: 8 }, { imdbId: GUMP, rating: "rated", score: 8 }];
    const base = { graph, watched, services: [HULU], candidates: [cand(MINI, { vector: [1, 0] }), cand(LATE_NIGHT, { vector: [0, 1] })] };
    const a = pickTonight({ ...base, taste: { vector: [1, 0] } });
    const b = pickTonight({ ...base, taste: { vector: [0, 1] } });
    expect(a.picks[0].imdbId).toBe(MINI);
    expect(b.picks[0].imdbId).toBe(LATE_NIGHT);
  });

  it("derives taste facts: people you keep watching, decades, tv share, avoided genres", async () => {
    const graph = await fixtureGraph();
    const watched: WatchedRow[] = [
      { imdbId: APOLLO, rating: "rated", score: 8 },
      { imdbId: GUMP, rating: "rated", score: 8 },
      { imdbId: GOOD_SERIES, rating: "rated", score: 8 },
      { imdbId: LATE_NIGHT, rating: "rated", score: 5 },
      { imdbId: MINI, rating: "rated", score: 5 },
    ];
    const f = tasteFacts(graph, watched, { runtimes: new Map([[APOLLO, 140], [GUMP, 142]]) });
    expect(f.people.slice(0, 2).map((p) => p.name).sort()).toEqual(["Gary Sinise", "Tom Hanks"]);
    expect(f.people[0].count).toBe(2);
    expect(f.eras).toEqual({ "1990s": 2, "2010s": 1 });
    // Finished facts count everything rated, not only the 7-and-ups: three of
    // the five are series (Good Series, Late Night, Mini Series).
    expect(f.tvShare).toBeCloseTo(3 / 5, 2);
    expect(f.avgRuntimeFinished).toBe(141);
    expect(f.genresAvoided).toEqual(expect.arrayContaining(["Talk-Show"]));
  });

  it("`seen` is finished with no opinion: it counts for tv share and runtime, never for people or eras", async () => {
    const graph = await fixtureGraph();
    const watched: WatchedRow[] = [
      { imdbId: APOLLO, rating: "rated", score: 8 },
      { imdbId: GUMP, rating: "rated", score: 8 },
      { imdbId: MINI, rating: "seen", score: null }, // a 2010 series, Gary Sinise, imported
    ];
    const f = tasteFacts(graph, watched, { runtimes: new Map([[APOLLO, 140], [GUMP, 142], [MINI, 60]]) });
    // Sinise is in all three, but the seen row is no evidence of taste.
    expect(f.people[0].count).toBe(2);
    expect(f.eras).toEqual({ "1990s": 2 });
    // Finished facts count it: one of three titles is TV, and its runtime is in the average.
    expect(f.tvShare).toBeCloseTo(1 / 3, 2);
    expect(f.avgRuntimeFinished).toBe(114);
  });

  // SPEC v5.1: "a drama I haven't seen" is kind + genre, and unseen is the default.
  it("filters by kind and by genre, case-insensitively", async () => {
    const graph = await fixtureGraph();
    const watched: WatchedRow[] = [{ imdbId: APOLLO, rating: "rated", score: 8 }];
    const candidates = [cand(GUMP), cand(MINI), cand(LATE_NIGHT), cand(LONG_RUNNER), cand(GOOD_SERIES)];
    const shows = pickTonight({ graph, watched, services: [HULU], candidates, filters: { kind: "show" } });
    expect([...shows.picks, ...shows.deck].map((p) => p.imdbId)).not.toContain(GUMP);
    expect(shows.rejected).toContainEqual({ imdbId: GUMP, why: "wrong kind" });

    const films = pickTonight({ graph, watched, services: [HULU], candidates, filters: { kind: "film" } });
    expect([...films.picks, ...films.deck].every((p) => p.titleType === "movie" || p.titleType === "tvMovie")).toBe(true);

    // Forrest Gump is Drama,Romance; Late Night Show is Comedy,Talk-Show.
    const drama = pickTonight({ graph, watched, services: [HULU], candidates, filters: { genre: "drama" } });
    expect([...drama.picks, ...drama.deck].map((p) => p.imdbId)).toContain(GUMP);
    expect([...drama.picks, ...drama.deck].map((p) => p.imdbId)).not.toContain(LATE_NIGHT);
    expect(drama.rejected).toContainEqual({ imdbId: LATE_NIGHT, why: "wrong genre" });
  });

  it("unseen is the default: a title with any row at all is never a pick, unless unseen is false", async () => {
    const graph = await fixtureGraph();
    const watched: WatchedRow[] = [
      { imdbId: APOLLO, rating: "rated", score: 8 },
      { imdbId: GUMP, rating: "want", score: null },
      { imdbId: MINI, rating: "unseen", score: null },
    ];
    const candidates = [cand(GUMP), cand(MINI), cand(LATE_NIGHT), cand(LONG_RUNNER)];
    const strict = pickTonight({ graph, watched, services: [HULU], candidates });
    const strictIds = [...strict.picks, ...strict.deck].map((p) => p.imdbId);
    expect(strictIds).not.toContain(GUMP);
    expect(strictIds).not.toContain(MINI);

    // Later back in: a "want" row is a candidate again.
    const loose = pickTonight({ graph, watched, services: [HULU], candidates, filters: { unseen: false } });
    expect([...loose.picks, ...loose.deck].map((p) => p.imdbId)).toContain(GUMP);
  });
});
