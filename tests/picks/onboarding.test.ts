import { describe, it, expect } from "vitest";
import { onboardingDeck } from "@/lib/picks/onboarding";
import { fixtureGraph } from "../agent/helpers";

describe("onboarding deck", () => {
  it("spreads across decades and formats, skips talk shows and excluded titles, and is deterministic", async () => {
    const graph = await fixtureGraph();
    const deck = onboardingDeck(graph, { size: 6 });
    expect(deck.length).toBeLessThanOrEqual(6);
    expect(deck.map((d) => d.imdbId)).not.toContain("tt0000003"); // Late Night Show is a talk show
    // Newest decade first, movie before series within it.
    expect(deck[0].year).toBeGreaterThanOrEqual(deck[deck.length - 1].year);
    expect(new Set(deck.map((d) => d.titleType)).size).toBeGreaterThan(1);
    expect(onboardingDeck(graph, { size: 6 })).toEqual(deck);
    expect(onboardingDeck(graph, { size: 6, exclude: [deck[0].imdbId] }).map((d) => d.imdbId)).not.toContain(deck[0].imdbId);
  });
});
