/**
 * `GET /api/taste/memory` reports what the last rewrite dropped: titles that
 * were in the old prose and are no longer in the log. You says so once, in one
 * `.t-meta` line under the memory header, and `ok` clears it for good.
 *
 * The line is lowercase-led like every other meta line; the titles are the only
 * things worth reading in it, so they carry `**` and render at `--ink`.
 */
const MAX_NAMED = 3;

/** The line, or null when there is nothing to say (which is most of the time). */
export function droppedLine(dropped: readonly string[]): string | null {
  const titles = dropped.map((t) => t.trim()).filter(Boolean);
  if (titles.length === 0) return null;
  const named = titles.slice(0, MAX_NAMED).map((t) => `**${t}**`);
  const rest = titles.length - named.length;
  if (rest > 0) return `no longer in your log: ${named.join(", ")} and ${rest} more`;
  const list = named.length === 1 ? named[0] : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
  return `no longer in your log: ${list}`;
}

/** The same line split for rendering: `bold` marks a title. */
export function droppedParts(dropped: readonly string[]): { text: string; bold: boolean }[] {
  const line = droppedLine(dropped);
  if (!line) return [];
  return line
    .split(/\*\*(.+?)\*\*/g)
    .map((chunk, i) => ({ text: chunk, bold: i % 2 === 1 }))
    .filter((part) => part.text !== "");
}
