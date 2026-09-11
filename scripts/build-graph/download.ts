import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const BASE = "https://datasets.imdbws.com";
export const DATASETS = [
  "name.basics",
  "title.basics",
  "title.ratings",
  "title.principals",
  "title.episode",
] as const;

/** Download any missing IMDb datasets into dir. Existing files are kept. */
export async function downloadDatasets(dir: string, log: (m: string) => void): Promise<void> {
  mkdirSync(dir, { recursive: true });
  for (const name of DATASETS) {
    const file = `${name}.tsv.gz`;
    const dest = path.join(dir, file);
    if (existsSync(dest)) {
      log(`have ${file}`);
      continue;
    }
    log(`downloading ${file}…`);
    const res = await fetch(`${BASE}/${file}`);
    if (!res.ok || !res.body) throw new Error(`Failed to download ${file}: ${res.status}`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  }
}
