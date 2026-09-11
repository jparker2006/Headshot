import path from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream, type InferUIMessageChunk } from "ai";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { buildGraph } from "../../scripts/build-graph/build";
import { IndustryGraph, type PackedGraph } from "@/lib/graph";
import type { HeadshotUIMessage } from "@/lib/agent";

export const FIXTURE = path.join(__dirname, "..", "fixtures", "imdb");

let packedPromise: Promise<PackedGraph> | undefined;
export function fixturePacked(): Promise<PackedGraph> {
  return (packedPromise ??= buildGraph({ inputDir: FIXTURE, voteFloor: 1000, buildId: "test" }));
}
export async function fixtureGraph(): Promise<IndustryGraph> {
  return new IndustryGraph(await fixturePacked());
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

/** One scripted model step: either a tool call or a text reply. */
export type Step = { tool: string; input: Record<string, unknown> } | { text: string };

function stepChunks(step: Step, i: number): LanguageModelV4StreamPart[] {
  if ("tool" in step) {
    return [
      { type: "tool-call", toolCallId: `call-${i}`, toolName: step.tool, input: JSON.stringify(step.input) },
      { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
    ];
  }
  return [
    { type: "text-start", id: `t${i}` },
    { type: "text-delta", id: `t${i}`, delta: step.text },
    { type: "text-end", id: `t${i}` },
    { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
  ];
}

/** A mock model that plays back a script one step per model call. */
export function scriptedModel(steps: Step[]) {
  let i = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      const step = steps[i];
      if (!step) throw new Error(`Mock model called ${i + 1} times but script has ${steps.length} steps`);
      const chunks = stepChunks(step, i++);
      return { stream: simulateReadableStream({ chunks, chunkDelayInMs: null, initialDelayInMs: null }) };
    },
  });
}

export function userMessage(text: string): HeadshotUIMessage {
  return { id: "u1", role: "user", parts: [{ type: "text", text }] };
}

export type Chunk = InferUIMessageChunk<HeadshotUIMessage>;

export async function collect(stream: ReadableStream<Chunk>): Promise<Chunk[]> {
  const out: Chunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
}

/** Path hops belonging to the most recent `chosen` event (an override resets earlier hops). */
export function currentHops(chunks: Chunk[]) {
  const lastChosen = chunks.map((c) => c.type).lastIndexOf("data-chosen");
  return chunks.slice(lastChosen).filter((c): c is Extract<Chunk, { type: "data-path-hop" }> => c.type === "data-path-hop");
}

export function ofType<T extends Chunk["type"]>(chunks: Chunk[], type: T) {
  return chunks.filter((c): c is Extract<Chunk, { type: T }> => c.type === type);
}
