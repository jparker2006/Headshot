/**
 * The system prompt lives in system.md next to this file so it can be edited
 * like prose. Read once per process; the Node runtime traces the static path
 * so the file ships with the function on Vercel.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const PROMPT_PATH = path.join(process.cwd(), "src", "lib", "agent", "system.md");

function load(): string {
  const md = readFileSync(PROMPT_PATH, "utf8");
  // Drop the document title line; everything else goes to the model as-is.
  return md.replace(/^# [^\n]*\n+/, "").trim();
}

export const SYSTEM_PROMPT = load();
