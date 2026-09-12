/**
 * The threads API as a factory over its dependencies (the seam the chat, taste
 * and tonight routes all use), so `tests/route/threads.test.ts` can inject a
 * fake user resolver and a memory store.
 *
 * Signed-in only: there is nothing to list for an anonymous session, and a
 * signed-out thread never leaves the browser (SPEC v5).
 */
import { MAX_TITLE_CHARS, type ThreadStore } from "./types";

export interface ThreadRouteDeps {
  /** Resolve the signed-in user for this request, or null. */
  userId: (req: Request) => Promise<string | null>;
  store: () => Promise<ThreadStore>;
}

const unauthorized = () => Response.json({ error: "sign_in_required" }, { status: 401 });
const notFound = () => Response.json({ error: "not_found" }, { status: 404 });

/** Thread ids are client-generated UUIDs; keep them boring so they are safe in a URL. */
export const THREAD_ID = /^[A-Za-z0-9_-]{8,64}$/;

async function json(req: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** A title from a request body: trimmed, sliced, and never empty. */
function parseTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const title = raw.trim().replace(/\s+/g, " ").slice(0, MAX_TITLE_CHARS);
  return title || null;
}

export function createThreadHandlers(deps: ThreadRouteDeps) {
  return {
    /** GET /api/threads — the user's threads, newest updated first. */
    async list(req: Request): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      const store = await deps.store();
      return Response.json({ threads: await store.listThreads(userId) });
    },

    /** POST /api/threads { id?, title? } — the client may name the id so it can open the thread first. */
    async create(req: Request): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      const body = (await json(req)) ?? {};
      if (body.id !== undefined && (typeof body.id !== "string" || !THREAD_ID.test(body.id))) {
        return Response.json({ error: "invalid id" }, { status: 400 });
      }
      const store = await deps.store();
      const thread = await store.createThread(userId, {
        id: body.id as string | undefined,
        title: parseTitle(body.title) ?? undefined,
      });
      return Response.json({ thread });
    },

    /** GET /api/threads/[id] — the thread and its messages. 404 when it is not theirs. */
    async get(req: Request, id: string): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      const store = await deps.store();
      const thread = await store.getThread(userId, id);
      if (!thread) return notFound();
      return Response.json({ thread, messages: await store.listMessages(userId, id) });
    },

    /** PATCH /api/threads/[id] { title }. */
    async rename(req: Request, id: string): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      const body = (await json(req)) ?? {};
      const title = parseTitle(body.title);
      if (!title) return Response.json({ error: "title required" }, { status: 400 });
      const store = await deps.store();
      const thread = await store.renameThread(userId, id, title);
      if (!thread) return notFound();
      return Response.json({ thread });
    },

    /** DELETE /api/threads/[id] — the thread and its messages. */
    async remove(req: Request, id: string): Promise<Response> {
      const userId = await deps.userId(req);
      if (!userId) return unauthorized();
      const store = await deps.store();
      await store.deleteThread(userId, id);
      return Response.json({ ok: true });
    },
  };
}
