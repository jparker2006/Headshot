/**
 * The Letterboxd username import, as a pure state machine over what the crawl
 * route actually answers (SPEC v5 → Letterboxd crawl). Settings and `/welcome`
 * both drive it and the Log page reads the same status shape, so the rules
 * live here and `tests/client/importState.test.ts` holds them to account
 * without a renderer or a network.
 *
 * The route:
 *   POST /api/taste/import/letterboxd { username }
 *     202 { started: true, username } | 200 { private: true }
 *     200 { cached: true, finishedAt, imported } | 404 { error: "not_found" }
 *     400 on a username that is not a Letterboxd one
 *   GET  /api/taste/import/letterboxd
 *     { status: idle | running | done | private | not_found | failed, imported?, … }
 */

/** Letterboxd's own rule for a username. */
export const USERNAME_RE = /^[A-Za-z0-9_]{2,15}$/;

export function validUsername(name: string): boolean {
  return USERNAME_RE.test(name.trim());
}

/** What `GET /api/taste/import/letterboxd` reports. */
export type CrawlStatus = "idle" | "running" | "done" | "private" | "not_found" | "failed";

export interface CrawlStatusBody {
  status: CrawlStatus;
  username?: string;
  imported?: number;
  startedAt?: string;
  finishedAt?: string;
}

export type ImportState =
  | { kind: "idle" }
  | { kind: "invalid" }
  | { kind: "importing"; username: string }
  | { kind: "done"; imported: number }
  | { kind: "private" }
  | { kind: "not-found" }
  | { kind: "failed" };

export type ImportEvent =
  | { type: "submit"; username: string }
  | { type: "started"; username: string }
  | { type: "cached"; imported: number }
  | { type: "private" }
  | { type: "not-found" }
  | { type: "invalid" }
  | { type: "failed" }
  | { type: "status"; body: CrawlStatusBody }
  | { type: "reset" };

export const initialImport: ImportState = { kind: "idle" };

/**
 * The response to the event that produced it. `submit` optimistically enters
 * `importing` so the field never sits silent while the POST is in flight, and
 * a `status` poll can only ever move the state to what the server says.
 */
export function importReducer(state: ImportState, event: ImportEvent): ImportState {
  switch (event.type) {
    case "submit":
      return validUsername(event.username) ? { kind: "importing", username: event.username.trim() } : { kind: "invalid" };
    case "started":
      return { kind: "importing", username: event.username };
    case "cached":
      return { kind: "done", imported: event.imported };
    case "private":
      return { kind: "private" };
    case "not-found":
      return { kind: "not-found" };
    case "invalid":
      return { kind: "invalid" };
    case "failed":
      return { kind: "failed" };
    case "reset":
      return { kind: "idle" };
    case "status":
      switch (event.body.status) {
        case "running":
          return { kind: "importing", username: event.body.username ?? (state.kind === "importing" ? state.username : "") };
        case "done":
          return { kind: "done", imported: event.body.imported ?? 0 };
        case "private":
          return { kind: "private" };
        case "not_found":
          return { kind: "not-found" };
        case "failed":
          return { kind: "failed" };
        default:
          // `idle` never undoes what this tab already knows: the first poll
          // often lands before the POST does, and would otherwise flicker the
          // field back to nothing.
          return state;
      }
  }
}

/** The POST's answer as the one event it means. */
export function eventFromPost(status: number, body: unknown): ImportEvent {
  const b = (body ?? {}) as { started?: boolean; username?: string; private?: boolean; cached?: boolean; imported?: number; error?: string };
  if (status === 202 && b.started) return { type: "started", username: b.username ?? "" };
  if (status === 200 && b.private) return { type: "private" };
  if (status === 200 && b.cached) return { type: "cached", imported: b.imported ?? 0 };
  if (status === 404) return { type: "not-found" };
  if (status === 400) return { type: "invalid" };
  if (status === 401) return { type: "failed" };
  return { type: "failed" };
}

/**
 * The one line under the field. One line only — an import is not a document
 * (DESIGN.md → Copy: "Helper text is one line and tells you the cost").
 */
export function importLine(state: ImportState): string {
  switch (state.kind) {
    case "idle":
      return "your username, not the whole URL. we read the public pages — the recent ones.";
    case "invalid":
      return "that is not a Letterboxd username.";
    case "importing":
      return "importing…";
    case "done":
      return `done. ${state.imported} ${state.imported === 1 ? "title" : "titles"} from your diary, recent films and watchlist. the CSV brings everything.`;
    case "private":
      return "that profile is private. export the CSV instead.";
    case "not-found":
      return "no profile by that name.";
    case "failed":
      return "letterboxd would not let us read the pages. export the CSV instead.";
  }
}

/** The CSV path is offered exactly when the crawl cannot do the job. */
export function showCsvFallback(state: ImportState): boolean {
  return state.kind === "private" || state.kind === "not-found" || state.kind === "failed";
}

/** Keep polling while the crawl is running, and only then. */
export function shouldPoll(state: ImportState): boolean {
  return state.kind === "importing";
}

/** How often the Log page and Settings ask again, in milliseconds. */
export const POLL_MS = 3000;
