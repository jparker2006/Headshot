import { describe, it, expect } from "vitest";
import {
  eventFromPost,
  importLine,
  importReducer,
  initialImport,
  shouldPoll,
  showCsvFallback,
  validUsername,
  type ImportEvent,
  type ImportState,
} from "@/components/imports/importState";

const run = (events: ImportEvent[], from: ImportState = initialImport) => events.reduce(importReducer, from);

describe("letterboxd username", () => {
  it("takes what Letterboxd takes", () => {
    expect(validUsername("jake")).toBe(true);
    expect(validUsername("Jake_2000")).toBe(true);
    expect(validUsername(" jake ")).toBe(true);
  });

  it("refuses a URL, an email and a name that is too short or too long", () => {
    expect(validUsername("letterboxd.com/jake")).toBe(false);
    expect(validUsername("jake@example.com")).toBe(false);
    expect(validUsername("j")).toBe(false);
    expect(validUsername("j".repeat(16))).toBe(false);
  });
});

describe("the POST's answer as an event", () => {
  it("reads every shape the route can return", () => {
    expect(eventFromPost(202, { started: true, username: "jake" })).toEqual({ type: "started", username: "jake" });
    expect(eventFromPost(200, { private: true })).toEqual({ type: "private" });
    expect(eventFromPost(200, { cached: true, finishedAt: "now", imported: 412 })).toEqual({ type: "cached", imported: 412 });
    expect(eventFromPost(404, { error: "not_found" })).toEqual({ type: "not-found" });
    expect(eventFromPost(400, {})).toEqual({ type: "invalid" });
    expect(eventFromPost(500, {})).toEqual({ type: "failed" });
  });
});

describe("the import state machine", () => {
  it("starts idle and offers no CSV until something goes wrong", () => {
    expect(initialImport).toEqual({ kind: "idle" });
    expect(showCsvFallback(initialImport)).toBe(false);
    expect(shouldPoll(initialImport)).toBe(false);
  });

  it("goes importing the moment you submit, before the POST lands", () => {
    expect(run([{ type: "submit", username: "jake" }])).toEqual({ kind: "importing", username: "jake" });
    expect(shouldPoll(run([{ type: "submit", username: "jake" }]))).toBe(true);
  });

  it("refuses a username that is not one without asking the server", () => {
    expect(run([{ type: "submit", username: "letterboxd.com/jake" }])).toEqual({ kind: "invalid" });
  });

  it("runs 202 → running → done", () => {
    const state = run([
      { type: "submit", username: "jake" },
      { type: "started", username: "jake" },
      { type: "status", body: { status: "running", username: "jake" } },
      { type: "status", body: { status: "done", imported: 412 } },
    ]);
    expect(state).toEqual({ kind: "done", imported: 412 });
    expect(shouldPoll(state)).toBe(false);
    expect(importLine(state)).toBe("done. 412 titles from your diary, recent films and watchlist. the CSV brings everything.");
  });

  it("answers a cached crawl with the count and no poll", () => {
    const state = run([{ type: "submit", username: "jake" }, { type: "cached", imported: 1 }]);
    expect(state).toEqual({ kind: "done", imported: 1 });
    expect(importLine(state)).toBe("done. 1 title from your diary, recent films and watchlist. the CSV brings everything.");
  });

  it("offers the CSV exactly when the crawl cannot do the job", () => {
    expect(showCsvFallback({ kind: "private" })).toBe(true);
    expect(showCsvFallback({ kind: "not-found" })).toBe(true);
    expect(showCsvFallback({ kind: "failed" })).toBe(true);
    expect(showCsvFallback({ kind: "done", imported: 3 })).toBe(false);
    expect(showCsvFallback({ kind: "importing", username: "jake" })).toBe(false);
  });

  it("says what to do about a private profile in one line", () => {
    const state = run([{ type: "submit", username: "jake" }, { type: "private" }]);
    expect(importLine(state)).toBe("that profile is private. export the CSV instead.");
    expect(importLine(state).split(". ").length).toBeLessThanOrEqual(2);
  });

  it("lets an idle poll leave a state this tab already knows alone", () => {
    const importing: ImportState = { kind: "importing", username: "jake" };
    expect(importReducer(importing, { type: "status", body: { status: "idle" } })).toBe(importing);
  });

  it("picks up a crawl that finished in another tab", () => {
    expect(importReducer({ kind: "idle" }, { type: "status", body: { status: "running", username: "jake" } })).toEqual({
      kind: "importing",
      username: "jake",
    });
  });

  it("reports a failure without an apology or an exclamation, and sends you to the CSV", () => {
    const line = importLine({ kind: "failed" });
    expect(line).not.toMatch(/!|sorry/i);
    // Letterboxd blocks a server on the paginated pages; the CSV is the way.
    expect(line).toBe("letterboxd would not let us read the pages. export the CSV instead.");
    expect(showCsvFallback({ kind: "failed" })).toBe(true);
  });

  it("says up front that the crawl only reaches the recent pages", () => {
    expect(importLine({ kind: "idle" })).toContain("the recent ones");
  });
});
