import type { HeadshotUIMessage } from "@/lib/agent/events";
import { titleFromMessages, type ThreadInput, type ThreadRow, type ThreadStore } from "./types";

interface StoredThread extends ThreadRow {
  userId: string;
  messages: HeadshotUIMessage[];
}

/**
 * The thread store in process memory: keyless dev, the route seam tests, and
 * the reference implementation `PostgresThreadStore` must match.
 */
export class MemoryThreadStore implements ThreadStore {
  private threads = new Map<string, StoredThread>();
  private seq = 0;
  private now: () => Date;

  constructor(opts: { now?: () => Date } = {}) {
    this.now = opts.now ?? (() => new Date());
  }

  private stamp(): string {
    return this.now().toISOString();
  }

  /** The row, only if it belongs to this user. */
  private own(userId: string, id: string): StoredThread | null {
    const t = this.threads.get(id);
    return t && t.userId === userId ? t : null;
  }

  private view(t: StoredThread): ThreadRow {
    return { id: t.id, title: t.title, createdAt: t.createdAt, updatedAt: t.updatedAt };
  }

  async listThreads(userId: string): Promise<ThreadRow[]> {
    return [...this.threads.values()]
      .filter((t) => t.userId === userId)
      // Newest updated first; the insertion counter breaks ties so a fake
      // clock still produces a stable order (the Postgres store sorts the same).
      .sort((a, b) => (a.updatedAt === b.updatedAt ? (a.id < b.id ? 1 : -1) : a.updatedAt < b.updatedAt ? 1 : -1))
      .map((t) => this.view(t));
  }

  async getThread(userId: string, id: string): Promise<ThreadRow | null> {
    const t = this.own(userId, id);
    return t ? this.view(t) : null;
  }

  async createThread(userId: string, input: ThreadInput = {}): Promise<ThreadRow> {
    const at = this.stamp();
    const id = input.id ?? `th-${String(++this.seq).padStart(9, "0")}`;
    const existing = this.own(userId, id);
    if (existing) return this.view(existing);
    const row: StoredThread = { id, userId, title: input.title ?? null, createdAt: at, updatedAt: at, messages: [] };
    this.threads.set(id, row);
    return this.view(row);
  }

  async renameThread(userId: string, id: string, title: string): Promise<ThreadRow | null> {
    const t = this.own(userId, id);
    if (!t) return null;
    t.title = title;
    t.updatedAt = this.stamp();
    return this.view(t);
  }

  async deleteThread(userId: string, id: string): Promise<void> {
    if (this.own(userId, id)) this.threads.delete(id);
  }

  async listMessages(userId: string, id: string): Promise<HeadshotUIMessage[]> {
    const t = this.own(userId, id);
    return t ? t.messages.map((m) => structuredClone(m)) : [];
  }

  async appendMessages(userId: string, id: string, messages: HeadshotUIMessage[]): Promise<void> {
    const t = this.own(userId, id);
    if (!t || messages.length === 0) return;
    for (const m of messages) {
      const i = t.messages.findIndex((x) => x.id === m.id);
      // Upsert in place: a re-sent turn replaces itself rather than duplicating.
      if (i >= 0) t.messages[i] = structuredClone(m);
      else t.messages.push(structuredClone(m));
    }
    if (!t.title) t.title = titleFromMessages(t.messages);
    t.updatedAt = this.stamp();
  }

  async deleteUser(userId: string): Promise<void> {
    for (const [id, t] of this.threads) if (t.userId === userId) this.threads.delete(id);
  }
}
