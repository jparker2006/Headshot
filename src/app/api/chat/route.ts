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
}

/** Route handler factory so tests can inject a mock model, a fixture graph, and a memory brain. */
export function createChatHandler(deps: ChatDeps) {
  return async function POST(req: Request): Promise<Response> {
    let body: { messages?: HeadshotUIMessage[] };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const messages = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages required" }, { status: 400 });
    }

    const [graph, brain] = await Promise.all([deps.graph(), deps.brain()]);
    const session = await deps.session(req);

    const limit = await checkLimits({ brain, ip: clientIp(req) });
    if (!limit.ok) return Response.json({ error: limit.reason, resting: true }, { status: 429 });
    await brain.recordQuestion({ sessionId: session.id, text: lastUserText(messages) });

    const stream = runAgent({
      model: deps.model(graph),
      graph,
      brain,
      tmdb: deps.tmdb(),
      messages,
      sessionId: session.id,
      followups: deps.followups ?? true,
      embed: deps.embed?.(),
      userId: deps.userId ? await deps.userId(req) : null,
      taste: deps.taste ? await deps.taste() : null,
      // Page writing and the v4 memory job (extract the turn's taste statements,
      // then rewrite the memory) outlive the response. waitUntil keeps the
      // function alive on Vercel and simply runs the promise locally.
      schedule: deps.schedule ?? ((work) => waitUntil(work().catch((err) => console.warn("[agent] background failed:", err)))),
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
  session: async () => {
    const jar = await cookies();
    const existing = jar.get(SESSION_COOKIE)?.value;
    return existing ? { id: existing, setCookie: false } : { id: newSessionId(), setCookie: true };
  },
});
