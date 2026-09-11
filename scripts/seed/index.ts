/**
 * Seed the brain by asking real questions through the chat route.
 *
 *   pnpm seed                                  # against http://localhost:3000
 *   pnpm seed --url https://headshot-hazel.vercel.app --concurrency 2
 *
 * Questions come from scripts/seed/questions.txt, one per line. Output is one
 * line per question with the Bacon number (if any), tool count, and duration.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    concurrency: { type: "string", default: "4" },
    file: { type: "string", default: path.join("scripts", "seed", "questions.txt") },
  },
});
const questions = readFileSync(values.file!, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const concurrency = Number(values.concurrency);
let i = 0;
let ok = 0;
let failed = 0;

async function ask(q: string, n: number) {
  const started = Date.now();
  try {
    const res = await fetch(`${values.url}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${Math.floor(n / 250)}.${n % 250}` },
      body: JSON.stringify({ messages: [{ id: `seed-${n}`, role: "user", parts: [{ type: "text", text: q }] }] }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${body.slice(0, 120)}`);
    const bacon = body.match(/"baconNumber":(\d+|null)/)?.[1] ?? "-";
    const tools = (body.match(/"type":"tool-input-start"/g) ?? []).length;
    const errors = (body.match(/"type":"tool-output-error"/g) ?? []).length;
    ok++;
    console.log(`ok   ${String(n).padStart(2)}  bacon=${bacon} tools=${tools}${errors ? ` errors=${errors}` : ""}  ${((Date.now() - started) / 1000).toFixed(0)}s  ${q}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${String(n).padStart(2)}  ${(err as Error).message.slice(0, 160)}  ${q}`);
  }
}

async function worker() {
  while (i < questions.length) {
    const n = i++;
    await ask(questions[n], n + 1);
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
console.log(`done: ${ok} ok, ${failed} failed, ${questions.length} total`);
