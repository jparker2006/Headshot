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
import { prehint, formatHints } from "./prehint";
import { generateFollowups } from "./followups";
import { writePagesForTurn } from "./pages";
import type { CanvasNode } from "./events";
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
  /** Cheap model for follow-ups and page writing; defaults to `model`. */
  sideModel?: LanguageModel;
  /** Generate follow-up chips after the answer (default true). */
  followups?: boolean;
  /**
   * Called after the answer with the work that should outlive the response
   * (page writing). The route runs it with Next's `after()`; tests await it.
   */
  schedule?: (work: () => Promise<void>) => void;
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
      const started = Date.now();
      opts.graph.setOverlay(await opts.brain.getOverlay());
      const ctx: AgentContext = {
        graph: opts.graph,
        brain: opts.brain,
        tmdb: opts.tmdb,
        emit: emitterFn(new WriterEmitter(writer)),
        sessionId: opts.sessionId,
        question,
        touched: [] as CanvasNode[],
      };
      const tools = headshotTools(ctx);
      const hints = formatHints(prehint(opts.graph, question));
      const result = streamText({
        model: opts.model,
        system: hints ? `${SYSTEM_PROMPT}\n\n${hints}` : SYSTEM_PROMPT,
        messages: await convertToModelMessages(opts.messages),
        tools,
        stopWhen: isStepCount(opts.maxSteps ?? 12),
        onStepFinish: (step) => {
          const tools = step.toolCalls.map((c) => c.toolName).join(",") || "text";
          console.log(`[agent] step ${tools} · ${Date.now() - started}ms · in ${step.usage.inputTokens ?? "?"} out ${step.usage.outputTokens ?? "?"}`);
        },
      });
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          tools,
          sendFinish: false,
          // Tool errors are our own messages ("X is not in the graph"); the client may see them.
          onError: (err) => (err instanceof Error ? err.message : String(err)),
        }),
      );

      // After the answer: follow-up chips into the stream, pages after the response.
      const answer = await Promise.resolve(result.text).catch(() => "");
      const side = opts.sideModel ?? opts.model;
      if (opts.followups !== false && answer) {
        try {
          const questions = await generateFollowups(side, question, answer);
          if (questions.length) writer.write({ type: "data-followups", data: { questions } });
        } catch (err) {
          console.warn("[followups] failed:", err instanceof Error ? err.message : err);
        }
      }
      writer.write({ type: "finish" });
      if (answer && ctx.touched.length) {
        const work = () =>
          writePagesForTurn({ model: side, brain: opts.brain, question, answer, touched: ctx.touched, log: (m) => console.log(m) }).then(() => undefined);
        if (opts.schedule) opts.schedule(work);
        else await work();
      }
    },
    onError: (err) => (err instanceof Error ? err.message : "Something went wrong"),
  });
}
