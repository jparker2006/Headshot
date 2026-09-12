/**
 * Server-side chat threads (SPEC v5). Signed-in conversations are stored per
 * user: one `threads` row per conversation, one `messages` row per UI message.
 * Signed-out threads stay in localStorage and never reach this store.
 *
 * Two implementations, one conformance suite (`tests/threads/store.test.ts`):
 * `MemoryThreadStore` for keyless dev and tests, `PostgresThreadStore` for Neon.
 */
import type { HeadshotUIMessage } from "@/lib/agent/events";

export interface ThreadRow {
  id: string;
  /** The first user text sliced to `MAX_TITLE_CHARS`; null until the first turn. */
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadInput {
  /** The client may supply a UUID so it can open the thread before the first turn. */
  id?: string;
  title?: string;
}

/** Longest auto-derived thread title. */
export const MAX_TITLE_CHARS = 60;

/**
 * Every method is scoped by user id: another user's thread id reads as null
 * and writes to it are no-ops. There is no cross-user read anywhere.
 */
export interface ThreadStore {
  /** The user's threads, newest updated first. */
  listThreads(userId: string): Promise<ThreadRow[]>;
  getThread(userId: string, id: string): Promise<ThreadRow | null>;
  createThread(userId: string, input?: ThreadInput): Promise<ThreadRow>;
  /** Null when the thread is not this user's. */
  renameThread(userId: string, id: string, title: string): Promise<ThreadRow | null>;
  /** Cascades to the thread's messages. */
  deleteThread(userId: string, id: string): Promise<void>;
  /** The thread's messages in created order; empty for a thread that is not theirs. */
  listMessages(userId: string, id: string): Promise<HeadshotUIMessage[]>;
  /**
   * Upsert by message id (a re-sent turn replaces itself), bump the thread's
   * `updatedAt`, and title an untitled thread from the first user text part.
   * A thread that is not this user's is left alone.
   */
  appendMessages(userId: string, id: string, messages: HeadshotUIMessage[]): Promise<void>;
  /** Delete account: every thread and message of this user. */
  deleteUser(userId: string): Promise<void>;
}

/** The first text part of a user message, trimmed and sliced, or null. */
export function titleFromMessages(messages: HeadshotUIMessage[]): string | null {
  for (const m of messages) {
    if (m.role !== "user") continue;
    for (const p of m.parts) {
      if (p.type !== "text") continue;
      const text = p.text.trim().replace(/\s+/g, " ");
      if (text) return text.slice(0, MAX_TITLE_CHARS);
    }
  }
  return null;
}
