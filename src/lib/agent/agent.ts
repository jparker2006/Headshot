/**
 * The Headshot agent loop. One call per user turn: builds the tool set over
 * the request context, runs the model with multi-step tool calling, and
 * streams text plus canvas events as one UI message stream.
 */
import {
  convertToModelMessages,
  createUIMessageStream,
  isStepCount,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type UIMessageStreamWriter,
} from "ai";
import type { IndustryGraph } from "@/lib/graph/engine";
import type { Brain } from "@/lib/brain/types";
import type { TmdbClient } from "@/lib/tmdb/client";
import { headshotTools } from "./tools";
import { SYSTEM_PROMPT } from "./system";
import type { AgentContext } from "./context";
import type { CanvasEmitter, HeadshotDataParts, HeadshotUIMessage } from "./events";

export interface RunAgentOptions {
  model: LanguageModel;
  graph: IndustryGraph;
  brain: Brain;
  tmdb: TmdbClient | null;
  messages: HeadshotUIMessage[];
  sessionId?: string;
  maxSteps?: number;
}

/** Adapts the UI stream writer to the tools' emitter interface. */
class WriterEmitter implements CanvasEmitter {
  constructor(private writer: UIMessageStreamWriter<HeadshotUIMessage>) {}
  emit<K extends keyof HeadshotDataParts>(type: K, data: HeadshotDataParts[K], opts?: { transient?: boolean }) {
    this.writer.write({ type: `data-${type}`, data, transient: opts?.transient } as Parameters<typeof this.writer.write>[0]);
  }
}

function emitterFn(e: CanvasEmitter): CanvasEmitter["emit"] {
  return e.emit.bind(e);
}

export function lastUserText(messages: HeadshotUIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    return m.parts
      .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("\n");
  }
  return "";
}

/** Runs one turn and returns the UI message stream to send to the client. */
export function runAgent(opts: RunAgentOptions) {
  const question = lastUserText(opts.messages);
  // The engine sees the brain's current overlay for this request.
  return createUIMessageStream<HeadshotUIMessage>({
    execute: async ({ writer }) => {
      opts.graph.setOverlay(await opts.brain.getOverlay());
      const ctx: AgentContext = {
        graph: opts.graph,
        brain: opts.brain,
        tmdb: opts.tmdb,
        emit: emitterFn(new WriterEmitter(writer)),
        sessionId: opts.sessionId,
        question,
      };
      const tools = headshotTools(ctx);
      const result = streamText({
        model: opts.model,
        system: SYSTEM_PROMPT,
        messages: await convertToModelMessages(opts.messages),
        tools,
        stopWhen: isStepCount(opts.maxSteps ?? 12),
      });
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          tools,
          // Tool errors are our own messages ("X is not in the graph"); the client may see them.
          onError: (err) => (err instanceof Error ? err.message : String(err)),
        }),
      );
    },
    onError: (err) => (err instanceof Error ? err.message : "Something went wrong"),
  });
}
