/**
 * Receipts: the line under an answer that says what the answer drew on.
 *
 * Board C puts a ledger under every answer ("what that came from"). We only
 * ever state facts the message itself carries — the entities the agent put on
 * the brain (`data-node`), and which taste tools actually returned — so the
 * line is never a decoration. No parts, no line: `receiptSegments` returns an
 * empty array and the thread renders nothing rather than inventing provenance.
 */
import type { HeadshotUIMessage } from "@/lib/agent/events";

/** Taste tools that read the user's private log. */
const TASTE_READS = new Set(["my_profile", "recall", "have_i_seen", "tonight"]);
/** Taste tools that write to it. */
const TASTE_WRITES = new Set(["log"]);

/**
 * The segments of the receipts line, in reading order: where the answer came
 * from, then what it touched, then what it changed. Joined with a mono `·`.
 */
export function receiptSegments(parts: HeadshotUIMessage["parts"]): string[] {
  const titles = new Set<string>();
  const people = new Set<string>();
  let read = false;
  let wrote = false;

  for (const p of parts) {
    if (p.type === "data-node") {
      (p.data.imdbId.startsWith("nm") ? people : titles).add(p.data.imdbId);
      continue;
    }
    if (!p.type.startsWith("tool-")) continue;
    // Only a tool that actually returned counts as a receipt.
    const state = "state" in p ? String(p.state) : "";
    if (state !== "output-available") continue;
    const name = p.type.slice(5);
    if (TASTE_READS.has(name)) read = true;
    if (TASTE_WRITES.has(name)) wrote = true;
  }

  const out: string[] = [];
  if (read) out.push("from your log");
  else if (titles.size + people.size > 0) out.push("from the graph");
  if (titles.size > 0) out.push(`${titles.size} ${titles.size === 1 ? "title" : "titles"}`);
  if (people.size > 0) out.push(`${people.size} ${people.size === 1 ? "person" : "people"}`);
  if (wrote) out.push("log updated");
  return out;
}

/** The line itself, or "" when there is nothing honest to say. */
export function receiptsLine(parts: HeadshotUIMessage["parts"]): string {
  return receiptSegments(parts).join(" · ");
}
