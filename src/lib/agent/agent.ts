/**
 * The Headshot agent loop. One call per user turn: builds the tool set over
 * the request context, runs the model with multi-step tool calling, and
 * streams text plus canvas events as one UI message stream.
 *
 * v2 adds two things before the model runs. The fast path classifies the
 * question and, when every entity resolves exactly, computes the deterministic
 * result and streams it first. The answer store replays a stored answer for a
 * repeat of the same (shape, entities) question without calling the model.
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
import type { Brain, RecordedEvent } from "@/lib/brain/types";
import type { TmdbClient } from "@/lib/tmdb/client";
import { headshotTools } from "./tools";
import { SYSTEM_PROMPT } from "./system";
import { prehint, formatHints } from "./prehint";
import { generateFollowups } from "./followups";
import { writePagesForTurn } from "./pages";
import { classify, runFastPath, type FastResult } from "./fastpath";
import { CACHEABLE, answerSlug, cacheKey, isPublicSafe, isReplayable, replayAnswer, shortId } from "./answers";
import { toBrainInput } from "./context";
import type { EmbedFn } from "./embeddings";
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
   * (page writing, stale-answer recompute). The route runs it with waitUntil; tests await it.
   */
  schedule?: (work: () => Promise<void>) => void;
  /** Classify and precompute before the model (default true). */
  fastPath?: boolean;
  /** "use" replays stored answers (default); "bypass" recomputes but still stores. */
  cache?: "use" | "bypass";
  /** Query embedder for semantic fallback (find_entities, find_by_constraints). */
  embed?: EmbedFn;
}

/** Adapts the UI stream writer to the tools' emitter interface, recording replayable events. */
class WriterEmitter implements CanvasEmitter {
  constructor(
    private writer: UIMessageStreamWriter<HeadshotUIMessage>,
    private recorded: RecordedEvent[],
  ) {}
  emit<K extends keyof HeadshotDataParts>(type: K, data: HeadshotDataParts[K], opts?: { transient?: boolean }) {
    this.writer.write({ type: `data-${type}`, data, transient: opts?.transient } as Parameters<typeof this.writer.write>[0]);
    if (!opts?.transient && isReplayable(type)) this.recorded.push({ type, data });
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

/** Drain a stream to completion (used to recompute a stale answer in the background). */
async function drain(stream: ReadableStream<unknown>): Promise<void> {
  const reader = stream.getReader();
  for (;;) {
    const { done } = await reader.read();
    if (done) return;
  }
}

/** Runs one turn and returns the UI message stream to send to the client. */
export function runAgent(opts: RunAgentOptions) {
  const question = lastUserText(opts.messages);
  // The engine sees the brain's current overlay for this request.
  return createUIMessageStream<HeadshotUIMessage>({
    execute: async ({ writer }) => {
      const started = Date.now();
      opts.graph.setOverlay(await opts.brain.getOverlay());
      const recorded: RecordedEvent[] = [];
      const ctx: AgentContext = {
        graph: opts.graph,
        brain: opts.brain,
        tmdb: opts.tmdb,
        emit: emitterFn(new WriterEmitter(writer, recorded)),
        sessionId: opts.sessionId,
        question,
        touched: [] as CanvasNode[],
        embed: opts.embed,
      };

      // ---- v2: classify, then either replay a stored answer or precompute ----
      const classified = opts.fastPath === false ? null : classify(opts.graph, question);
      const key = classified && CACHEABLE.has(classified.shape) ? cacheKey(classified.shape, classified.entities.map((e) => e.imdbId)) : null;

      if (key && opts.cache !== "bypass") {
        const hit = await opts.brain.getAnswer(key);
        if (hit && hit.narration) {
          const stale = hit.graphBuildId !== opts.graph.buildId;
          console.log(`[agent] cache hit ${key}${stale ? " (stale, recomputing in background)" : ""}`);
          replayAnswer(writer, hit, { stale });
          writer.write({ type: "data-answer", data: { id: hit.id, slug: hit.slug, public: hit.public } });
          writer.write({ type: "finish" });
          // The replayed nodes still count for this session's glow.
          const nodes = hit.events.filter((e) => e.type === "node").map((e) => toBrainInput(e.data as CanvasNode));
          if (nodes.length) await opts.brain.touchNodes(nodes, opts.sessionId);
          if (stale) {
            const work = () => drain(runAgent({ ...opts, cache: "bypass" }));
            if (opts.schedule) opts.schedule(work);
            else await work();
          }
          return;
        }
      }

      let fast: FastResult | null = null;
      if (classified) {
        const imdbIds = classified.entities.map((e) => e.imdbId);
        ctx.emit("fast", { shape: classified.shape, imdbIds, cached: false }, { transient: true });
        try {
          fast = await runFastPath(ctx, classified);
          console.log(`[agent] fast path ${classified.shape} ${imdbIds.join(",")} · ${Date.now() - started}ms`);
        } catch (err) {
          console.warn("[agent] fast path failed, falling through:", err instanceof Error ? err.message : err);
        }
      }

      const tools = headshotTools(ctx);
      const hints = formatHints(prehint(opts.graph, question));
      const system = [SYSTEM_PROMPT, hints, fast ? `Precomputed for this question (the user already sees it on the canvas):\n${fast.context}` : ""].filter(Boolean).join("\n\n");
      const result = streamText({
        model: opts.model,
        system,
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
      let followups: string[] = [];
      if (opts.followups !== false && answer) {
        try {
          followups = await generateFollowups(side, question, answer);
          if (followups.length) writer.write({ type: "data-followups", data: { questions: followups } });
        } catch (err) {
          console.warn("[followups] failed:", err instanceof Error ? err.message : err);
        }
      }

      // Store the answer so the next identical question replays instantly.
      if (key && fast && classified && answer) {
        try {
          const saved = await opts.brain.saveAnswer({
            id: shortId(),
            slug: answerSlug(classified.shape, classified.entities.map((e) => e.name)),
            shape: classified.shape,
            entityIds: [...fast.imdbIds].sort(),
            cacheKey: key,
            question,
            chosenPath: fast.chosenPath,
            summary: fast.summary,
            narration: answer,
            followups,
            events: recorded,
            graphBuildId: opts.graph.buildId,
            sessionId: opts.sessionId ?? null,
            public: isPublicSafe(question),
          });
          writer.write({ type: "data-answer", data: { id: saved.id, slug: saved.slug, public: saved.public } });
        } catch (err) {
          console.warn("[answers] save failed:", err instanceof Error ? err.message : err);
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
