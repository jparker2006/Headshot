import { describe, it, expect } from "vitest";
import { faceTapAction, meanText } from "@/components/chat/faceGridRule";
import type { HeadshotUIMessage } from "@/lib/agent/events";

const grid = { type: "data-faces", data: { query: "the astronaut", candidates: [], total: 0, mode: "choose" } } as HeadshotUIMessage["parts"][number];
const answerGrid = { type: "data-faces", data: { query: "the priest", candidates: [], total: 40, mode: "answer" } } as HeadshotUIMessage["parts"][number];
const text = (t: string) => ({ type: "text", text: t }) as HeadshotUIMessage["parts"][number];

describe("face grid tap rule", () => {
  it("opens the page when the model wrote nothing after the grid", () => {
    expect(faceTapAction([text("Let me look."), grid], 1)).toBe("open");
    expect(faceTapAction([grid, text("   ")], 0)).toBe("open");
  });
  it("continues the conversation when the answer goes on", () => {
    expect(faceTapAction([grid, text("Which one did you mean?")], 0)).toBe("ask");
    expect(meanText("Gary Sinise")).toBe("I mean Gary Sinise");
  });
  it("always opens the page for an answer face, even when the answer text follows", () => {
    expect(faceTapAction([answerGrid, text("that's Andrew Scott.")], 0)).toBe("open");
    expect(faceTapAction([answerGrid], 0)).toBe("open");
  });

  it("lets a later grid own the text after it", () => {
    expect(faceTapAction([grid, grid, text("Pick one.")], 0)).toBe("open");
    expect(faceTapAction([grid, grid, text("Pick one.")], 1)).toBe("ask");
  });
});
