/**
 * Headshot offline pipeline.
 *
 *   pnpm build:graph                       # download IMDb datasets to data/imdb, build, write data/graph-<id>.bin
 *   pnpm build:graph --input tests/fixtures/imdb --floor 1
 *   pnpm build:graph --upload              # also upload to Vercel Blob (needs BLOB_READ_WRITE_TOKEN)
 *
 * Stage two (full casts and character names from TMDB, packed as weak edges):
 *
 *   pnpm build:graph --skip-download --tmdb                       # top 20000 titles by votes
 *   pnpm build:graph --tmdb --tmdb-titles 30 --out data/smoke.bin # small dry run
 *   pnpm build:graph --tmdb --tmdb-cache data/tmdb --tmdb-concurrency 20
 *
 * Raw TMDB JSON is cached under --tmdb-cache, so reruns are free and offline.
 * Needs TMDB_BEARER_TOKEN (environment or .env.local).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_VOTE_FLOOR, knownPeopleByTitle, loadImdb, pack, topTitlesForCrawl } from "./build";
import { downloadDatasets } from "./download";
import { crawlCredits, tmdbTokenFromEnv, type CachedCredits } from "./tmdb";
import { encodeGraph } from "../../src/lib/graph/format";

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      floor: { type: "string" },
      out: { type: "string" },
      upload: { type: "boolean", default: false },
      "skip-download": { type: "boolean", default: false },
      tmdb: { type: "boolean", default: false },
      "tmdb-titles": { type: "string" },
      "tmdb-cache": { type: "string" },
      "tmdb-concurrency": { type: "string" },
    },
  });
  const log = (m: string) => console.log(`[build-graph] ${m}`);
  const inputDir = values.input ?? path.join("data", "imdb");
  const voteFloor = values.floor ? Number(values.floor) : DEFAULT_VOTE_FLOOR;
  const buildId = new Date().toISOString().slice(0, 10);

  if (!values.input && !values["skip-download"]) await downloadDatasets(inputDir, log);

  const stage = await loadImdb({ inputDir, voteFloor, log });

  let tmdb: Map<string, CachedCredits> | undefined;
  if (values.tmdb) {
    const cacheDir = values["tmdb-cache"] ?? path.join("data", "tmdb");
    const limit = values["tmdb-titles"] ? Number(values["tmdb-titles"]) : 20000;
    const concurrency = values["tmdb-concurrency"] ? Number(values["tmdb-concurrency"]) : 20;
    const titles = topTitlesForCrawl(stage, limit);
    log(`tmdb: crawling ${titles.length} titles into ${cacheDir}`);
    tmdb = await crawlCredits({
      titles,
      cacheDir,
      token: tmdbTokenFromEnv() ?? "",
      concurrency,
      knownPeople: knownPeopleByTitle(stage),
      log,
    });
  }

  const graph = pack(stage, { buildId, tmdb, log });
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
