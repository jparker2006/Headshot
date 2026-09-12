import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import type { BrainDatabase } from "@/lib/brain/postgres";
import { messages as messagesTable, threads } from "@/lib/brain/schema";
import type { HeadshotUIMessage } from "@/lib/agent/events";
import { titleFromMessages, type ThreadInput, type ThreadRow, type ThreadStore } from "./types";

type ThreadDbRow = typeof threads.$inferSelect;

/** Monotonic within the process; part of a generated thread id. */
let threadSeq = 0;

function toRow(row: ThreadDbRow): ThreadRow {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Threads on Postgres (Neon in production, PGlite in tests). Semantics match
 * `MemoryThreadStore` exactly; one conformance suite runs over both.
 */
export class PostgresThreadStore implements ThreadStore {
  private db: BrainDatabase;
  private now: () => Date;
  /** Last created_at handed out, so message order is strictly increasing even under a fake clock. */
  private lastAt = 0;

  constructor(source: string | BrainDatabase, opts: { now?: () => Date } = {}) {
    this.db = typeof source === "string" ? neonDrizzle(source) : source;
    this.now = opts.now ?? (() => new Date());
  }

  private id(): string {
    return `th-${Date.now().toString(36)}-${String(++threadSeq).padStart(6, "0")}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async listThreads(userId: string): Promise<ThreadRow[]> {
    const rows = await this.db
      .select()
      .from(threads)
      .where(eq(threads.userId, userId))
      // Ties break by id descending, exactly as the memory store does.
      .orderBy(desc(threads.updatedAt), desc(threads.id));
    return rows.map(toRow);
  }

  async getThread(userId: string, id: string): Promise<ThreadRow | null> {
    const rows = await this.db
      .select()
      .from(threads)
      .where(and(eq(threads.id, id), eq(threads.userId, userId)))
      .limit(1);
    return rows[0] ? toRow(rows[0]) : null;
  }

  async createThread(userId: string, input: ThreadInput = {}): Promise<ThreadRow> {
    const id = input.id ?? this.id();
    const existing = await this.getThread(userId, id);
    if (existing) return existing;
    const at = this.now();
    const rows = await this.db
      .insert(threads)
      .values({ id, userId, title: input.title ?? null, createdAt: at, updatedAt: at })
      .returning();
    return toRow(rows[0]);
  }

  async renameThread(userId: string, id: string, title: string): Promise<ThreadRow | null> {
    const rows = await this.db
      .update(threads)
      .set({ title, updatedAt: this.now() })
      .where(and(eq(threads.id, id), eq(threads.userId, userId)))
      .returning();
    return rows[0] ? toRow(rows[0]) : null;
  }

  async deleteThread(userId: string, id: string): Promise<void> {
    // The messages go with it: the foreign key is ON DELETE CASCADE.
    await this.db.delete(threads).where(and(eq(threads.id, id), eq(threads.userId, userId)));
  }

  async listMessages(userId: string, id: string): Promise<HeadshotUIMessage[]> {
    if (!(await this.getThread(userId, id))) return [];
    const rows = await this.db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, id))
      .orderBy(asc(messagesTable.createdAt), asc(messagesTable.id));
    return rows.map((r) => ({ id: r.id, role: r.role, parts: r.parts } as HeadshotUIMessage));
  }

  async appendMessages(userId: string, id: string, list: HeadshotUIMessage[]): Promise<void> {
    if (list.length === 0) return;
    const thread = await this.getThread(userId, id);
    if (!thread) return;
    const at = this.now();
    // Postgres refuses an ON CONFLICT that hits the same row twice in one
    // statement, so the last message for an id wins before we send it.
    const byId = new Map<string, HeadshotUIMessage>();
    for (const m of list) byId.set(m.id, m);
    // Strictly increasing, even when two calls share a millisecond (or a fake
    // clock never moves): created order must reproduce insertion order.
    let next = Math.max(at.getTime(), this.lastAt + 1);
    await this.db
      .insert(messagesTable)
      .values(
        [...byId.values()].map((m) => ({
          id: m.id,
          threadId: id,
          role: m.role,
          parts: m.parts as unknown[],
          // Ordered within the same call, so created order is insertion order.
          createdAt: new Date((this.lastAt = next++)),
        })),
      )
      .onConflictDoUpdate({
        target: messagesTable.id,
        set: { role: sql`excluded.role`, parts: sql`excluded.parts` },
      });

    const title = thread.title ?? titleFromMessages(await this.listMessages(userId, id));
    await this.db
      .update(threads)
      .set({ updatedAt: at, title: title ?? null })
      .where(and(eq(threads.id, id), eq(threads.userId, userId)));
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete(threads).where(eq(threads.userId, userId));
  }
}
