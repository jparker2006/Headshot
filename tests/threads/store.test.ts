import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import { MemoryThreadStore } from "@/lib/threads/memory";
import { PostgresThreadStore } from "@/lib/threads/postgres";
import type { ThreadStore } from "@/lib/threads/types";
import type { HeadshotUIMessage } from "@/lib/agent/events";

const MIGRATIONS = path.join(__dirname, "..", "..", "drizzle");

/** A thread-store factory: fresh, empty, with an optional injected clock. */
type StoreFactory = (opts?: { now?: () => Date }) => Promise<ThreadStore>;

let client: PGlite;
let db: PgliteDatabase;

beforeAll(async () => {
  client = new PGlite({ extensions: { vector } });
  await client.waitReady;
  db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS });
}, 120_000);

afterAll(async () => {
  await client?.close();
});

async function truncate() {
  await db.execute(
    sql`truncate table "page_revisions", "pages", "nodes", "overlay_edges", "questions", "embeddings", "answers", "watched", "services", "taste", "tonight", "titles", "memory", "episodes", "threads", "messages"`,
  );
}

function user(id: string, text: string): HeadshotUIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistant(id: string, text: string): HeadshotUIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] };
}

/** Every behavioural assertion both thread stores must satisfy. */
function describeStore(name: string, factory: StoreFactory) {
  describe(name, () => {
    it("creates with a client-supplied id and reads back", async () => {
      const store = await factory();
      const t = await store.createThread("u1", { id: "thread-aaaaaaaa" });
      expect(t).toMatchObject({ id: "thread-aaaaaaaa", title: null });
      expect(typeof t.createdAt).toBe("string");
      expect(typeof t.updatedAt).toBe("string");
      expect(await store.getThread("u1", "thread-aaaaaaaa")).toMatchObject({ id: "thread-aaaaaaaa" });
      // Creating the same id twice is idempotent, not an error.
      expect((await store.createThread("u1", { id: "thread-aaaaaaaa" })).id).toBe("thread-aaaaaaaa");
      expect(await store.listThreads("u1")).toHaveLength(1);
    });

    it("mints an id when the client does not supply one, and takes a title", async () => {
      const store = await factory();
      const t = await store.createThread("u1", { title: "named" });
      expect(t.id.length).toBeGreaterThan(4);
      expect(t.title).toBe("named");
    });

    it("lists newest updated first", async () => {
      let tick = 0;
      const store = await factory({ now: () => new Date(1_700_000_000_000 + tick * 60_000) });
      await store.createThread("u1", { id: "thread-01" });
      tick = 1;
      await store.createThread("u1", { id: "thread-02" });
      tick = 2;
      await store.createThread("u1", { id: "thread-03" });
      expect((await store.listThreads("u1")).map((t) => t.id)).toEqual(["thread-03", "thread-02", "thread-01"]);
      // A turn on the oldest thread floats it to the top.
      tick = 3;
      await store.appendMessages("u1", "thread-01", [user("m1", "hello")]);
      expect((await store.listThreads("u1")).map((t) => t.id)).toEqual(["thread-01", "thread-03", "thread-02"]);
    });

    it("stores a turn's messages in order and titles the thread from the first user text", async () => {
      const store = await factory();
      await store.createThread("u1", { id: "thread-bbbbbbbb" });
      await store.appendMessages("u1", "thread-bbbbbbbb", [user("m1", "  how is  tom hanks connected to kevin bacon?  ")]);
      await store.appendMessages("u1", "thread-bbbbbbbb", [assistant("m2", "two hops.")]);

      const msgs = await store.listMessages("u1", "thread-bbbbbbbb");
      expect(msgs.map((m) => m.id)).toEqual(["m1", "m2"]);
      expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
      expect(msgs[1].parts).toEqual([{ type: "text", text: "two hops." }]);
      // Whitespace collapsed, sliced to 60 chars.
      expect((await store.getThread("u1", "thread-bbbbbbbb"))!.title).toBe("how is tom hanks connected to kevin bacon?");
    });

    it("slices a long title to 60 characters and never retitles a titled thread", async () => {
      const store = await factory();
      await store.createThread("u1", { id: "thread-cccccccc" });
      const long = "a".repeat(200);
      await store.appendMessages("u1", "thread-cccccccc", [user("m1", long)]);
      expect((await store.getThread("u1", "thread-cccccccc"))!.title).toBe("a".repeat(60));
      await store.appendMessages("u1", "thread-cccccccc", [user("m2", "something else")]);
      expect((await store.getThread("u1", "thread-cccccccc"))!.title).toBe("a".repeat(60));
    });

    it("upserts by message id rather than duplicating", async () => {
      const store = await factory();
      await store.createThread("u1", { id: "thread-dddddddd" });
      await store.appendMessages("u1", "thread-dddddddd", [user("m1", "first"), assistant("m2", "draft")]);
      await store.appendMessages("u1", "thread-dddddddd", [assistant("m2", "final")]);
      const msgs = await store.listMessages("u1", "thread-dddddddd");
      expect(msgs).toHaveLength(2);
      expect(msgs[1].parts).toEqual([{ type: "text", text: "final" }]);
    });

    it("keeps arbitrary UI parts intact through the round trip", async () => {
      const store = await factory();
      await store.createThread("u1", { id: "thread-eeeeeeee" });
      const rich: HeadshotUIMessage = {
        id: "m1",
        role: "assistant",
        parts: [
          { type: "text", text: "**Tom Hanks**" },
          { type: "data-node", data: { imdbId: "nm0000158", name: "Tom Hanks", kind: "person", titleType: "", year: 0, votes: 1, genres: "", inIndustryGraph: true } },
        ],
      } as unknown as HeadshotUIMessage;
      await store.appendMessages("u1", "thread-eeeeeeee", [rich]);
      expect((await store.listMessages("u1", "thread-eeeeeeee"))[0]).toEqual(rich);
    });

    it("renames, and deletes the thread with its messages", async () => {
      const store = await factory();
      await store.createThread("u1", { id: "thread-ffffffff" });
      await store.appendMessages("u1", "thread-ffffffff", [user("m1", "hi")]);
      expect((await store.renameThread("u1", "thread-ffffffff", "my chat"))!.title).toBe("my chat");
      expect((await store.getThread("u1", "thread-ffffffff"))!.title).toBe("my chat");

      await store.deleteThread("u1", "thread-ffffffff");
      expect(await store.getThread("u1", "thread-ffffffff")).toBeNull();
      expect(await store.listMessages("u1", "thread-ffffffff")).toEqual([]);
      expect(await store.listThreads("u1")).toEqual([]);
    });

    it("scopes everything by user: another user's thread id is invisible", async () => {
      const store = await factory();
      await store.createThread("u1", { id: "thread-gggggggg" });
      await store.appendMessages("u1", "thread-gggggggg", [user("m1", "mine")]);

      expect(await store.getThread("u2", "thread-gggggggg")).toBeNull();
      expect(await store.listThreads("u2")).toEqual([]);
      expect(await store.listMessages("u2", "thread-gggggggg")).toEqual([]);
      expect(await store.renameThread("u2", "thread-gggggggg", "hijacked")).toBeNull();

      // Neither a write nor a delete from the wrong user touches the row.
      await store.appendMessages("u2", "thread-gggggggg", [user("m2", "theirs")]);
      await store.deleteThread("u2", "thread-gggggggg");
      expect((await store.getThread("u1", "thread-gggggggg"))!.title).toBe("mine");
      expect(await store.listMessages("u1", "thread-gggggggg")).toHaveLength(1);
    });

    it("appending to a thread that does not exist is a no-op", async () => {
      const store = await factory();
      await store.appendMessages("u1", "thread-nonexistent", [user("m1", "hi")]);
      expect(await store.listThreads("u1")).toEqual([]);
      await store.appendMessages("u1", "thread-nonexistent", []);
    });

    it("deleteUser clears every thread and message of that user only", async () => {
      const store = await factory();
      await store.createThread("u1", { id: "thread-hhhhhhhh" });
      await store.createThread("u1", { id: "thread-iiiiiiii" });
      await store.createThread("u2", { id: "thread-jjjjjjjj" });
      await store.appendMessages("u1", "thread-hhhhhhhh", [user("m1", "hi")]);
      await store.appendMessages("u2", "thread-jjjjjjjj", [user("m2", "hi")]);

      await store.deleteUser("u1");
      expect(await store.listThreads("u1")).toEqual([]);
      expect(await store.listMessages("u1", "thread-hhhhhhhh")).toEqual([]);
      expect((await store.listThreads("u2")).map((t) => t.id)).toEqual(["thread-jjjjjjjj"]);
      expect(await store.listMessages("u2", "thread-jjjjjjjj")).toHaveLength(1);
    });
  });
}

describeStore("MemoryThreadStore", async (opts = {}) => new MemoryThreadStore(opts));

describeStore("PostgresThreadStore", async (opts = {}) => {
  await truncate();
  return new PostgresThreadStore(db, opts);
});
