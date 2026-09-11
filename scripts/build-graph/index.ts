/**
 * Headshot offline pipeline.
 *
 *   pnpm build:graph                       # download IMDb datasets to data/imdb, build, write data/graph-<id>.bin
 *   pnpm build:graph --input tests/fixtures/imdb --floor 1
 *   pnpm build:graph --upload              # also upload to Vercel Blob (needs BLOB_READ_WRITE_TOKEN)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildGraph, DEFAULT_VOTE_FLOOR } from "./build";
import { downloadDatasets } from "./download";
import { encodeGraph } from "../../src/lib/graph/format";

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      floor: { type: "string" },
      out: { type: "string" },
      upload: { type: "boolean", default: false },
      "skip-download": { type: "boolean", default: false },
    },
  });
  const log = (m: string) => console.log(`[build-graph] ${m}`);
  const inputDir = values.input ?? path.join("data", "imdb");
  const voteFloor = values.floor ? Number(values.floor) : DEFAULT_VOTE_FLOOR;
  const buildId = new Date().toISOString().slice(0, 10);

  if (!values.input && !values["skip-download"]) await downloadDatasets(inputDir, log);

  const graph = await buildGraph({ inputDir, voteFloor, buildId, log });
  const bytes = encodeGraph(graph);

  const outPath = values.out ?? path.join("data", `graph-${buildId}.bin`);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  log(`wrote ${outPath} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB)`);

  if (values.upload) {
    const { put } = await import("@vercel/blob");
    const key = `graphs/graph-${buildId}.bin`;
    const res = await put(key, Buffer.from(bytes), { access: "public", addRandomSuffix: false });
    log(`uploaded ${res.url}`);
    log(`set HEADSHOT_GRAPH_URL=${res.url}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
