"use client";
/**
 * The signed-in session list. v5 moves conversations server-side for anyone
 * with an account (SPEC v5 → Ask): `/api/threads` is the list, newest updated
 * first, and the chat route stores both sides of a turn itself — so this hook
 * only ever lists, creates, renames and deletes, and re-fetches after a turn
 * finishes.
 *
 * Signed out nothing here runs: those threads stay in localStorage
 * (`threads.ts`) and are never listed.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface ServerThread {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

async function json<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

export interface ServerThreads {
  threads: ServerThread[];
  loading: boolean;
  /** Re-read the list: after a finished turn, and after create/rename/delete. */
  refresh: () => void;
  /** The client picks the id so the transport can carry it on the first turn. */
  create: (init?: { id?: string; title?: string }) => Promise<ServerThread | null>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useServerThreads(signedIn: boolean): ServerThreads {
  const [threads, setThreads] = useState<ServerThread[]>([]);
  const [loading, setLoading] = useState(signedIn);
  // A list that arrives after a newer one must not overwrite it.
  const seq = useRef(0);

  const refresh = useCallback(() => {
    // Signed out there is nothing to read: the list is empty by derivation
    // below, so this stays a no-op rather than a synchronous state write.
    if (!signedIn) return;
    const mine = ++seq.current;
    fetch("/api/threads", { cache: "no-store" })
      .then((r) => json<{ threads: ServerThread[] }>(r))
      .then((d) => {
        if (mine !== seq.current) return;
        setThreads(d?.threads ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (mine === seq.current) setLoading(false);
      });
  }, [signedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (init?: { id?: string; title?: string }) => {
      if (!signedIn) return null;
      const id = init?.id ?? crypto.randomUUID();
      const title = init?.title;
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(title ? { id, title } : { id }),
      }).catch(() => null);
      const body = res ? await json<{ thread: ServerThread }>(res) : null;
      const thread =
        body?.thread ?? (res?.ok ? { id, title: title ?? null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : null);
      if (thread) setThreads((prev) => [thread, ...prev.filter((t) => t.id !== thread.id)]);
      return thread;
    },
    [signedIn],
  );

  const rename = useCallback(
    async (id: string, title: string) => {
      // Optimistic: the row is the thing being typed into, so it must not wait.
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
      await fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      }).catch(() => {});
      refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      setThreads((prev) => prev.filter((t) => t.id !== id));
      await fetch(`/api/threads/${id}`, { method: "DELETE" }).catch(() => {});
      refresh();
    },
    [refresh],
  );

  return { threads: signedIn ? threads : [], loading: signedIn ? loading : false, refresh, create, rename, remove };
}

/** The messages of one thread, for `useChat`'s initial state. */
export async function loadServerThread(id: string): Promise<{ title: string | null; messages: unknown[] } | null> {
  const res = await fetch(`/api/threads/${id}`, { cache: "no-store" }).catch(() => null);
  if (!res) return null;
  const body = await json<{ thread: { title: string | null }; messages: unknown[] }>(res);
  if (!body) return null;
  return { title: body.thread?.title ?? null, messages: body.messages ?? [] };
}
