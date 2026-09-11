/**
 * The thread header's mono line: `3h ago · 2 messages`.
 *
 * Terse on purpose — board C writes time the way a terminal would (`3h ago`,
 * `2d ago`), not the way prose does ("3 hours ago"). Kept pure so the header
 * is a test rather than a screenshot.
 */

/** `just now` / `12m ago` / `3h ago` / `2d ago` / `12 Mar`. "" if unparseable. */
export function shortAgo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const then = new Date(iso);
  const ms = then.getTime();
  if (Number.isNaN(ms)) return "";
  const secs = Math.round((now.getTime() - ms) / 1000);
  if (secs < 90) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** `3h ago · 2 messages`; either half is dropped when we do not have it. */
export function threadMetaLine(createdAt: string | null | undefined, messages: number, now: Date = new Date()): string {
  const parts: string[] = [];
  const ago = shortAgo(createdAt, now);
  if (ago) parts.push(ago);
  if (messages > 0) parts.push(`${messages} ${messages === 1 ? "message" : "messages"}`);
  return parts.join(" · ");
}
