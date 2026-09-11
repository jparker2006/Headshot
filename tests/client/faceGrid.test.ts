import { describe, it, expect } from "vitest";
import { faceTapAction, meanText } from "@/components/chat/faceGridRule";
import type { HeadshotUIMessage } from "@/lib/agent/events";

const grid = { type: "data-faces", data: { query: "the astronaut", candidates: [], total: 0 } } as HeadshotUIMessage["parts"][number];
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
  it("lets a later grid own the text after it", () => {
    expect(faceTapAction([grid, grid, text("Pick one.")], 0)).toBe("open");
    expect(faceTapAction([grid, grid, text("Pick one.")], 1)).toBe("ask");
  });
});
