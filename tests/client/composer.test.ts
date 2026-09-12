/**
 * The Ask composer's rules and the bubble collapsing (SPEC v5.1 → "Composer",
 * "Stored answers"). Both are pure modules, so this holds the whole behaviour
 * without rendering React.
 */
import { describe, expect, it } from "vitest";
import { MAX_ROWS, MAX_ROWS_PHONE, keyAction, rowsFor, sendState } from "@/components/chat/composerRules";
import { liveToolIndex, mergedText } from "@/components/chat/bubbleRules";

describe("the composer's keys", () => {
  it("sends on Enter and breaks a line on Shift+Enter", () => {
    expect(keyAction({ key: "Enter" })).toBe("send");
    expect(keyAction({ key: "Enter", shiftKey: true })).toBe("newline");
  });

  it("leaves an IME's Enter alone", () => {
    expect(keyAction({ key: "Enter", isComposing: true })).toBe("none");
    expect(keyAction({ key: "Enter", keyCode: 229 })).toBe("none");
  });

  it("has no opinion about any other key", () => {
    expect(keyAction({ key: "a" })).toBe("none");
    expect(keyAction({ key: "Escape" })).toBe("none");
  });
});

describe("how tall the box gets", () => {
  it("starts at one row and grows a row per line", () => {
    expect(rowsFor("")).toBe(1);
    expect(rowsFor("one line")).toBe(1);
    expect(rowsFor("a\nb\nc")).toBe(3);
  });

  it("stops at the cap — six lines, four on a phone — and scrolls past it", () => {
    const ten = Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n");
    expect(rowsFor(ten)).toBe(MAX_ROWS);
    expect(rowsFor(ten, MAX_ROWS_PHONE)).toBe(MAX_ROWS_PHONE);
    expect(MAX_ROWS).toBe(6);
    expect(MAX_ROWS_PHONE).toBe(4);
  });
});

describe("the send control", () => {
  it("is a ghost with nothing to send", () => {
    expect(sendState({ text: "", busy: false })).toBe("disabled");
    expect(sendState({ text: "   \n ", busy: false })).toBe("disabled");
  });

  it("lights once there is text", () => {
    expect(sendState({ text: "who is in Heat?", busy: false })).toBe("send");
  });

  it("becomes stop while the turn runs, text or not", () => {
    expect(sendState({ text: "", busy: true })).toBe("stop");
    expect(sendState({ text: "half typed", busy: true })).toBe("stop");
  });
});

describe("one bubble per answer", () => {
  it("drops whitespace-only parts and merges the rest", () => {
    const parts = [
      { type: "text", text: "" },
      { type: "tool-log", state: "output-available" },
      { type: "text", text: "Logged **The Wire** at 9.7." },
      { type: "text", text: "   " },
      { type: "text", text: "Three more to go." },
    ];
    expect(mergedText(parts)).toBe("Logged **The Wire** at 9.7.\n\nThree more to go.");
  });

  it("is empty when nothing was said", () => {
    expect(mergedText([{ type: "text", text: "  " }, { type: "data-faces" }])).toBe("");
  });

  it("names one live tool step, the last one still running", () => {
    const parts = [
      { type: "tool-find_entities", state: "output-available" },
      { type: "tool-tonight", state: "input-available" },
      { type: "tool-log", state: "input-streaming" },
    ];
    expect(liveToolIndex(parts)).toBe(2);
    expect(liveToolIndex([{ type: "tool-log", state: "output-available" }])).toBe(-1);
    expect(liveToolIndex([{ type: "text", text: "hi" }])).toBe(-1);
  });
});
