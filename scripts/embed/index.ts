/**
 * Embed the top entities of the industry graph into the brain (pgvector), so
 * find_entities and find_by_constraints can fall back to semantic search
 * when a description matches no name.
 *
 *   pnpm embed                       # top 50,000 by votes, from HEADSHOT_GRAPH_PATH / HEADSHOT_GRAPH_URL
 *   pnpm embed --top 5000 --batch 100
 *
 * Needs OPENROUTER_API_KEY and DATABASE_URL (read from .env.local if present).
 * Idempotent: rows are upserted, and reruns after a new graph build refresh them.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

async function main() {
  loadEnvLocal();
  const { values } = parseArgs({
    options: {
      top: { type: "string", default: "50000" },
      batch: { type: "string", default: "100" },
      concurrency: { type: "string", default: "4" },
    },
  });
  const [{ getIndustryGraph }, { PostgresBrain }, { embeddingModelFromEnv }, { embedBatch, entityText }] = await Promise.all([
    import("../../src/lib/graph/loader"),
    import("../../src/lib/brain/postgres"),
    import("../../src/lib/agent/provider"),
    import("../../src/lib/agent/embeddings"),
  ]);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const graph = await getIndustryGraph();
  const brain = new PostgresBrain(process.env.DATABASE_URL);
  const model = embeddingModelFromEnv();

  const top = Number(values.top);
  const batch = Number(values.batch);
  const concurrency = Number(values.concurrency);
  const ids: number[] = [];
  for (let id = 0; id < graph.nodeCount; id++) ids.push(id);
  ids.sort((a, b) => graph.node(b).votes - graph.node(a).votes || a - b);
  const chosen = ids.slice(0, top);
  console.log(`[embed] ${chosen.length} entities (build ${graph.buildId}), batches of ${batch}`);

  const started = Date.now();
  let done = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < chosen.length) {
      const slice = chosen.slice(cursor, cursor + batch);
      cursor += batch;
      const nodes = slice.map((id) => graph.node(id));
      const texts = nodes.map((n) => entityText(graph, n));
      let vectors: number[][] | null = null;
      for (let attempt = 0; attempt < 4 && !vectors; attempt++) {
        try {
          vectors = await embedBatch(model, texts);
        } catch (err) {
          console.warn(`[embed] batch failed (attempt ${attempt + 1}):`, err instanceof Error ? err.message : err);
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        }
      }
      if (!vectors) throw new Error("embedding batch failed repeatedly");
      await brain.upsertEmbeddings(nodes.map((n, i) => ({ imdbId: n.imdbId, embedding: vectors![i] })));
      done += nodes.length;
      if (done % 2000 < batch) console.log(`[embed] ${done}/${chosen.length} · ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`[embed] done: ${done} rows in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
