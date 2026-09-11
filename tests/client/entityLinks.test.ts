import { describe, it, expect } from "vitest";
import { entityIndex, looksLikeName, makeIndex, resolveEntity, threadIndex } from "@/components/chat/entityLinks";
import type { HeadshotUIMessage } from "@/lib/agent/events";

const node = (imdbId: string, name: string, kind: "person" | "title") =>
  ({ type: "data-node", data: { imdbId, name, kind, titleType: kind === "title" ? "movie" : "", year: 1995, votes: 10, genres: "", inIndustryGraph: true } }) as HeadshotUIMessage["parts"][number];

describe("entity links (cursor for movies)", () => {
  it("indexes names from node, path, and candidate parts and resolves emphasized text", () => {
    const parts: HeadshotUIMessage["parts"] = [
      node("nm0000001", "Kevin Bacon", "person"),
      node("tt0000001", "Apollo 13", "title"),
      { type: "data-candidates", data: { query: "Tom", candidates: [{ imdbId: "nm0000002", name: "Tom Hanks", kind: "person", titleType: "", year: 0, votes: 0, genres: "", inIndustryGraph: true }] } },
      { type: "data-paths", data: { from: "nm0000001", to: "nm0000004", baconNumber: 1, differ: false, strong: null, full: { baconNumber: 1, truncated: false, paths: [{ imdbIds: ["nm0000001", "tt0000001", "nm0000004"], names: ["Kevin Bacon", "Apollo 13", "Gary Sinise"] }] } } },
      { type: "text", text: "**Kevin Bacon** was in **Apollo 13 (1995)** with **Gary Sinise**." },
    ];
    const idx = entityIndex(parts);
    expect(resolveEntity(idx, "Kevin Bacon")).toMatchObject({ imdbId: "nm0000001", kind: "person" });
    expect(resolveEntity(idx, "kevin bacon's")).toMatchObject({ imdbId: "nm0000001" });
    expect(resolveEntity(idx, "Apollo 13 (1995)")).toMatchObject({ imdbId: "tt0000001", kind: "title" });
    expect(resolveEntity(idx, "Gary Sinise")).toMatchObject({ imdbId: "nm0000004" });
    expect(resolveEntity(idx, "Tom Hanks")).toMatchObject({ imdbId: "nm0000002" });
    expect(resolveEntity(idx, "two degrees")).toBeNull();
  });

  it("prefers the chosen path's referent when two nodes share a name", () => {
    const parts: HeadshotUIMessage["parts"] = [
      node("tt0000009", "Heat", "title"),
      { type: "data-chosen", data: { from: "a", to: "b", tier: "strong", index: 0, reason: "", path: { imdbIds: ["nm1", "tt0000002", "nm2"], names: ["A", "Heat", "B"] } } },
    ];
    expect(resolveEntity(entityIndex(parts), "Heat")?.imdbId).toBe("tt0000002");
  });

  it("ignores diacritics and curly apostrophes", () => {
    const idx = makeIndex([{ imdbId: "nm1", name: "Timothée Chalamet", kind: "person" }]);
    expect(resolveEntity(idx, "Timothee Chalamet")?.imdbId).toBe("nm1");
    expect(resolveEntity(idx, "Timothée Chalamet’s")?.imdbId).toBe("nm1");
  });

  it("spans a thread so later answers can link earlier names", () => {
    const messages: HeadshotUIMessage[] = [
      { id: "1", role: "assistant", parts: [node("nm0000001", "Kevin Bacon", "person")] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "**Kevin Bacon** again." }] },
    ];
    expect(resolveEntity(threadIndex(messages), "Kevin Bacon")?.imdbId).toBe("nm0000001");
  });

  it("only offers a search fallback for name-like emphasis", () => {
    expect(looksLikeName("Meryl Streep")).toBe(true);
    expect(looksLikeName("12 Angry Men")).toBe(true);
    expect(looksLikeName("two degrees apart")).toBe(false);
    expect(looksLikeName("1995")).toBe(false);
  });
});
