import { beforeEach, describe, expect, it } from "vitest";
import { tasteForPage } from "@/lib/page/taste";
import { MemoryTasteStore } from "@/lib/taste/memory";
import type { IndustryGraph } from "@/lib/graph/engine";
import { fixtureGraph } from "../agent/helpers";

const APOLLO = "tt0000001";
const GUMP = "tt0000002";
const HANKS = "nm0000002";
const SINISE = "nm0000004";
const HULU = 15;
const NETFLIX = 8;

let graph: IndustryGraph;
let store: MemoryTasteStore;

const titleExtras = (flatrate: { id?: number; name: string }[]) => ({ providers: { flatrate } });

beforeEach(async () => {
  graph = await fixtureGraph();
  store = new MemoryTasteStore();
});

describe("tasteForPage", () => {
  it("is null for a signed-out reader", async () => {
    await store.upsertWatched("user-1", [{ titleImdbId: APOLLO, rating: "liked", source: "letterboxd" }]);
    expect(await tasteForPage({ graph, store, userId: null, node: { imdbId: GUMP, kind: "title" } })).toBeNull();
  });

  it("explains a title through the people you already liked, and rings them", async () => {
    await store.upsertWatched("user-1", [{ titleImdbId: APOLLO, rating: "liked", source: "letterboxd" }]);
    const taste = await tasteForPage({ graph, store, userId: "user-1", node: { imdbId: GUMP, kind: "title" } });
    expect(taste).not.toBeNull();
    expect(taste!.reason?.text).toContain("Tom Hanks");
    expect(taste!.reason?.text).toContain("Gary Sinise");
    expect(taste!.reason?.text).toContain("Apollo 13");
    expect(taste!.reason?.viaImdbIds).toContain(APOLLO);
    expect(taste!.likedPeople).toContain(HANKS);
    expect(taste!.likedPeople).toContain(SINISE);
  });

  it("has no reason when nothing on the title touches your taste", async () => {
    await store.upsertWatched("user-1", [{ titleImdbId: "tt0000005", rating: "liked", source: "swipe" }]);
    const taste = await tasteForPage({ graph, store, userId: "user-1", node: { imdbId: GUMP, kind: "title" } });
    expect(taste!.reason).toBeNull();
    expect(taste!.likedPeople).toEqual([]);
  });

  it("explains a person through their titles you liked", async () => {
    await store.upsertWatched("user-1", [{ titleImdbId: APOLLO, rating: "liked", source: "letterboxd" }]);
    const taste = await tasteForPage({ graph, store, userId: "user-1", node: { imdbId: HANKS, kind: "person" } });
    expect(taste!.reason?.text).toBe("you liked Apollo 13");
    expect(taste!.reason?.viaImdbIds).toEqual([APOLLO]);
    expect(taste!.likedPeople).toEqual([APOLLO]);
  });

  it("counts a person's liked titles when there is more than one", async () => {
    await store.upsertWatched("user-1", [
      { titleImdbId: APOLLO, rating: "liked", source: "letterboxd" },
      { titleImdbId: GUMP, rating: "liked", source: "letterboxd" },
    ]);
    const taste = await tasteForPage({ graph, store, userId: "user-1", node: { imdbId: HANKS, kind: "person" } });
    // Forrest Gump first: more votes.
    expect(taste!.reason?.text).toBe("you liked Forrest Gump and Apollo 13");
    expect(taste!.reason?.viaImdbIds).toEqual([GUMP, APOLLO]);
  });

  it("round-trips the user's bucket for the title", async () => {
    await store.upsertWatched("user-1", [{ titleImdbId: GUMP, rating: "want", source: "swipe" }]);
    expect((await tasteForPage({ graph, store, userId: "user-1", node: { imdbId: GUMP, kind: "title" } }))!.rating).toBe("want");
    await store.upsertWatched("user-1", [{ titleImdbId: GUMP, rating: "meh", source: "swipe" }]);
    expect((await tasteForPage({ graph, store, userId: "user-1", node: { imdbId: GUMP, kind: "title" } }))!.rating).toBe("meh");
    expect((await tasteForPage({ graph, store, userId: "user-1", node: { imdbId: APOLLO, kind: "title" } }))!.rating).toBeNull();
  });

  it("names only the services the user actually pays for", async () => {
    await store.setServices("user-1", { providerIds: [HULU] });
    const taste = await tasteForPage({
      graph,
      store,
      userId: "user-1",
      node: { imdbId: GUMP, kind: "title" },
      extras: titleExtras([
        { id: NETFLIX, name: "Netflix" },
        { id: HULU, name: "Hulu" },
      ]),
    });
    expect(taste!.onYourServices).toEqual(["Hulu"]);
  });

  it("resolves a legacy provider id to the service on the checklist", async () => {
    await store.setServices("user-1", { providerIds: [2616] }); // Paramount+
    const taste = await tasteForPage({
      graph,
      store,
      userId: "user-1",
      node: { imdbId: GUMP, kind: "title" },
      extras: titleExtras([{ id: 531, name: "Paramount Plus" }]),
    });
    expect(taste!.onYourServices).toEqual(["Paramount+"]);
  });

  it("says nothing about services when the title streams nowhere the user pays for", async () => {
    await store.setServices("user-1", { providerIds: [HULU] });
    const taste = await tasteForPage({ graph, store, userId: "user-1", node: { imdbId: GUMP, kind: "title" }, extras: titleExtras([{ id: NETFLIX, name: "Netflix" }]) });
    expect(taste!.onYourServices).toEqual([]);
  });
});
