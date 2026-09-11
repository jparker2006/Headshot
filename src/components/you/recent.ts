/**
 * Two pure rules the You page leans on, kept out of the component so they can
 * be tested without a renderer: how a timestamp reads in prose, and which ten
 * rows count as "recently logged".
 */
import type { WatchedRow } from "@/lib/taste/types";

/**
 * "just now" / "3 hours ago" / "yesterday" / "12 Mar" — the shape the page
 * speaks in. Anything unparseable reads as an empty string rather than
 * "Invalid Date"; a future stamp (clock skew) reads as "just now".
 */
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const then = new Date(iso);
  const ms = then.getTime();
  if (Number.isNaN(ms)) return "";
  const secs = Math.round((now.getTime() - ms) / 1000);
  if (secs < 90) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 28) {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** The buckets as the log says them out loud. */
export const BUCKET_LABEL: Record<string, string> = {
  liked: "liked",
  meh: "meh",
  want: "want to watch",
  seen: "seen",
  unseen: "not seen",
};

/**
 * The last `limit` rows the user touched, newest first. Rows the user has not
 * watched (`want`, `unseen`) are still part of the log — "recently logged" is
 * about the act of logging, not about the verdict — but a row with no
 * `updatedAt` sorts last rather than to the top.
 */
export function recentlyLogged<T extends Pick<WatchedRow, "updatedAt">>(rows: readonly T[], limit = 10): T[] {
  return [...rows]
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, limit);
}
