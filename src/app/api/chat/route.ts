import { createUIMessageStreamResponse, type LanguageModel } from "ai";
import { cookies } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { getIndustryGraph, type IndustryGraph } from "@/lib/graph";
import { getBrain, type Brain } from "@/lib/brain";
import { tmdbFromEnv, type TmdbClient } from "@/lib/tmdb/client";
import { chatModelFromEnv, embeddingModelFromEnv, mockAgentEnabled } from "@/lib/agent/provider";
import { embedderFor, type EmbedFn } from "@/lib/agent/embeddings";
import { runAgent, lastUserText, type HeadshotUIMessage } from "@/lib/agent";
import { mockModel } from "@/lib/agent/mockModel";
import { checkLimits, SESSION_COOKIE, newSessionId } from "@/lib/limits";
import type { TasteStore } from "@/lib/taste/types";
import type { ThreadStore } from "@/lib/threads/types";

export const maxDuration = 120;

export interface ChatDeps {
  model: (graph: IndustryGraph) => LanguageModel;
  graph: () => Promise<IndustryGraph>;
  brain: () => Promise<Brain>;
  tmdb: () => TmdbClient | null;
  /** Resolve the session id for this request; may mint one. */
  session: (req: Request) => Promise<{ id: string; setCookie: boolean }>;
  followups?: boolean;
  schedule?: (work: () => Promise<void>) => void;
  embed?: () => EmbedFn | undefined;
  /** The signed-in user for this request, and the taste store. */
  userId?: (req: Request) => Promise<string | null>;
  taste?: () => Promise<TasteStore>;
  /** v5: server-side threads. Both sides of a signed-in turn are stored. */
  threads?: () => Promise<ThreadStore>;
}

/** Client-generated thread ids: UUID-ish and safe in a URL. */
const THREAD_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** The last user message of a turn — the half we store before the model runs. */
function lastUserMessage(messages: HeadshotUIMessage[]): HeadshotUIMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return messages[i];
  return null;
}

/** Route handler factory so tests can inject a mock model, a fixture graph, and a memory brain. */
export function createChatHandler(deps: ChatDeps) {
  return async function POST(req: Request): Promise<Response> {
    let body: { messages?: HeadshotUIMessage[]; threadId?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const messages = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages required" }, { status: 400 });
    }

    const threadId = typeof body.threadId === "string" && THREAD_ID.test(body.threadId) ? body.threadId : null;

    const [graph, brain] = await Promise.all([deps.graph(), deps.brain()]);
    const session = await deps.session(req);

    const limit = await checkLimits({ brain, ip: clientIp(req) });
    if (!limit.ok) return Response.json({ error: limit.reason, resting: true }, { status: 429 });
    await brain.recordQuestion({ sessionId: session.id, text: lastUserText(messages) });

    const userId = deps.userId ? await deps.userId(req) : null;
    const schedule = deps.schedule ?? ((work: () => Promise<void>) => waitUntil(work().catch((err) => console.warn("[agent] background failed:", err))));

    // v5 threads: a signed-in turn is stored on both sides. Signed out (or
    // with no threadId) nothing reaches the server — those threads live in
    // localStorage. The user half is written before the model runs so a
    // dropped connection still leaves the question in the log.
    let threads: ThreadStore | null = null;
    if (userId && threadId && deps.threads) {
      try {
        threads = await deps.threads();
        await threads.createThread(userId, { id: threadId });
        const asked = lastUserMessage(messages);
        if (asked) await threads.appendMessages(userId, threadId, [asked]);
      } catch (err) {
        console.warn("[threads] could not open the thread:", err instanceof Error ? err.message : err);
        threads = null;
      }
    }

    const stream = runAgent({
      model: deps.model(graph),
      graph,
      brain,
      tmdb: deps.tmdb(),
      messages,
      sessionId: session.id,
      followups: deps.followups ?? true,
      embed: deps.embed?.(),
      userId,
      taste: deps.taste ? await deps.taste() : null,
      // Page writing and the v4 memory job (extract the turn's taste statements,
      // then rewrite the memory) outlive the response. waitUntil keeps the
      // function alive on Vercel and simply runs the promise locally.
      schedule,
      onFinish: threads
        ? async (assistant) => {
            try {
              await threads!.appendMessages(userId!, threadId!, [assistant]);
            } catch (err) {
              console.warn("[threads] could not store the answer:", err instanceof Error ? err.message : err);
            }
          }
        : undefined,
    });
    const res = createUIMessageStreamResponse({ stream });
    if (session.setCookie) {
      res.headers.append("Set-Cookie", `${SESSION_COOKIE}=${session.id}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`);
    }
    return res;
  };
}

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export const POST = createChatHandler({
  model: (graph) => (mockAgentEnabled() ? mockModel(graph) : chatModelFromEnv()),
  graph: getIndustryGraph,
  brain: getBrain,
  tmdb: tmdbFromEnv,
  embed: () => (process.env.OPENROUTER_API_KEY && !mockAgentEnabled() ? embedderFor(embeddingModelFromEnv()) : undefined),
  // Lazy: the auth SDK pulls in next/headers, which the route seam tests cannot load.
  userId: () => import("@/lib/auth/server").then((m) => m.currentUserId()),
  taste: () => import("@/lib/taste").then((m) => m.getTasteStore()),
  threads: () => import("@/lib/threads").then((m) => m.getThreadStore()),
  session: async () => {
    const jar = await cookies();
    const existing = jar.get(SESSION_COOKIE)?.value;
    return existing ? { id: existing, setCookie: false } : { id: newSessionId(), setCookie: true };
  },
});
