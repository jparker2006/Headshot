/**
 * Dev-only scripted model (HEADSHOT_MOCK_AGENT=1). Lets you run the whole
 * app, including the canvas animation, without an OpenRouter key. It only
 * understands "connect A to B" / "A to B" style questions and always picks
 * the first tied path. Never used in production.
 */
import { simulateReadableStream, type LanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import type { IndustryGraph, NodeInfo } from "@/lib/graph/engine";

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

export function mockModel(graph: IndustryGraph): LanguageModel {
  return new MockLanguageModelV4({
    provider: "headshot-mock",
    modelId: "scripted",
    doStream: async (options: LanguageModelV4CallOptions) => {
      const chunks = plan(graph, options);
      return { stream: simulateReadableStream({ chunks, chunkDelayInMs: 40, initialDelayInMs: 200 }) };
    },
  });
}

function plan(graph: IndustryGraph, options: LanguageModelV4CallOptions): LanguageModelV4StreamPart[] {
  const prompt = options.prompt;
  const lastUser = [...prompt].reverse().find((m) => m.role === "user");
  const question = lastUser && Array.isArray(lastUser.content)
    ? lastUser.content.map((c) => ("text" in c ? c.text : "")).join(" ")
    : "";
  const toolResults = prompt.filter((m) => m.role === "tool").length;
  const step = toolResults;
  const system = prompt.find((m) => m.role === "system");
  const precomputed = typeof system?.content === "string" && system.content.includes("Precomputed for this question");

  const m = question.match(/(?:connect|link|how is|how's)?\s*(.+?)\s+(?:to|and|with)\s+(.+?)\??$/i);
  const a = m ? graph.searchByName(m[1].trim(), 1, "person")[0] : undefined;
  const b = m ? graph.searchByName(m[2].trim(), 1, "person")[0] : undefined;

  if (!a || !b) return text(`I only understand "connect A to B" in mock mode. Try "Connect Tom Hanks to Gary Sinise".`);
  if (precomputed && step === 0) return narrate(graph, a, b, question, "fast path: no tools called");
  if (step === 0) return toolCall("find_entities", { query: a.name, kind: "person" });
  if (step === 1) return toolCall("shortest_path", { from: a.imdbId, to: b.imdbId });
  if (step === 2) return toolCall("highlight_path", { from: a.imdbId, to: b.imdbId, tier: "full", index: 0, reason: "First tied path (mock)." });
  if (step === 3) return toolCall("write_page", { imdbId: a.imdbId, body: `${a.name} was connected to ${b.name} by the mock agent while answering: "${question}".` });
  return narrate(graph, a, b, question, "no model was called");
}

function narrate(graph: IndustryGraph, a: NodeInfo, b: NodeInfo, question: string, note: string): LanguageModelV4StreamPart[] {
  void question;
  const r = graph.tieredPaths(a.id, b.id);
  const chain = r.full?.paths[0].map((id) => `**${graph.node(id).name}**`).join(" → ");
  return text(
    r.full
      ? `**${a.name}** → **${b.name}**: ${r.full.baconNumber} degrees apart.\n\n${chain}\n\n*(mock agent: ${note})*`
      : `No connection between **${a.name}** and **${b.name}** in the graph.`,
  );
}

function toolCall(name: string, input: Record<string, unknown>): LanguageModelV4StreamPart[] {
  return [
    { type: "tool-call", toolCallId: `mock-${name}-${Date.now()}`, toolName: name, input: JSON.stringify(input) },
    { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
  ];
}

function text(t: string): LanguageModelV4StreamPart[] {
  const words = t.split(/(?<=\s)/);
  return [
    { type: "text-start", id: "t" },
    ...words.map<LanguageModelV4StreamPart>((w) => ({ type: "text-delta", id: "t", delta: w })),
    { type: "text-end", id: "t" },
    { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
  ];
}
