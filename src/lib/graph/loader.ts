/**
 * Loads the packed industry graph once per process and hands out the engine.
 *
 * Source precedence:
 *   HEADSHOT_GRAPH_PATH  — local file (dev, tests)
 *   HEADSHOT_GRAPH_URL   — Vercel Blob URL (production)
 */
import { readFile } from "node:fs/promises";
import { decodeGraph } from "./format";
import { IndustryGraph } from "./engine";

const g = globalThis as unknown as { __headshotGraph?: Promise<IndustryGraph> };

export function getIndustryGraph(): Promise<IndustryGraph> {
  if (!g.__headshotGraph) g.__headshotGraph = load();
  return g.__headshotGraph;
}

async function load(): Promise<IndustryGraph> {
  const path = process.env.HEADSHOT_GRAPH_PATH;
  const url = process.env.HEADSHOT_GRAPH_URL;
  const started = Date.now();
  let bytes: Uint8Array;
  if (path) {
    bytes = new Uint8Array(await readFile(path));
  } else if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch graph ${url}: ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  } else {
    throw new Error("Set HEADSHOT_GRAPH_PATH (local file) or HEADSHOT_GRAPH_URL (Blob) to load the industry graph");
  }
  const packed = decodeGraph(bytes);
  const graph = new IndustryGraph(packed);
  console.log(
    `[graph] loaded build ${packed.header.buildId}: ${packed.header.nodeCount} nodes, ${packed.header.edgeCount} edges in ${Date.now() - started}ms`,
  );
  return graph;
}
