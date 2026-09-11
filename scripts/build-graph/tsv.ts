import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

/**
 * Stream an IMDb TSV (optionally gzipped) row by row. The first line is the
 * header; each subsequent row is yielded as an array of columns. "\N" is
 * IMDb's null and is passed through unchanged; callers decide what it means.
 */
export async function* readTsv(path: string): AsyncGenerator<string[]> {
  const raw = createReadStream(path);
  const input = path.endsWith(".gz") ? raw.pipe(createGunzip()) : raw;
  const rl = createInterface({ input, crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false;
      continue;
    }
    if (line.length === 0) continue;
    yield line.split("\t");
  }
}

export const NULL = "\\N";
