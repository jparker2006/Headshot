/**
 * The new-chat opener: tonight's pick, computed on demand, sitting where every
 * chat product puts its greeting (SPEC v5 → Ask; design/research-v5.md §10).
 *
 * Kept pure so the copy and the mono line are a test rather than a screenshot.
 * The line itself ("tonight: **X** on hbo max, because …") comes from the
 * server — the client never writes a reason.
 */
import type { PickView } from "@/lib/picks/view";

/** `2012 · film · hbo max · already paid for`. Any half we do not have is dropped. */
export function openerMetaLine(pick: PickView): string {
  const kind = pick.titleType === "movie" || pick.titleType === "tvMovie" ? "film" : "show";
  return [
    pick.year ? String(pick.year) : null,
    kind,
    pick.providerNames[0]?.toLowerCase() ?? null,
    pick.onYourServices ? "already paid for" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The one button under the opener. It is the only accent in the view, so it
 * exists only when there is somewhere to send you; a title we can point at but
 * not name a service for falls back to the quiet "Where to watch".
 */
export function openerPlay(pick: PickView): { label: string; url: string; accent: boolean } | null {
  if (!pick.playUrl) return null;
  if (pick.playLabel) return { label: pick.playLabel, url: pick.playUrl, accent: true };
  return { label: "Where to watch", url: pick.playUrl, accent: false };
}

export type OpenerState = "loading" | "ready" | "none" | "signed-out";

/** What the empty column says while it has no pick to show. Never a spinner. */
export function openerCopy(state: Exclude<OpenerState, "ready">): string {
  if (state === "loading") return "finding one for tonight…";
  if (state === "none") return "log a few things and I'll have one for tonight.";
  return "ask me who was in what. sign in and I'll know what you've seen.";
}
