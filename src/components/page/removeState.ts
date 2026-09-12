/**
 * The drawer's "remove from log" control, as a state machine rather than three
 * booleans. Removing a row is irreversible (the row, its logging episodes and
 * the memory's claim about the title all go), so it asks once — the same
 * two-step Settings uses on `delete account` and the rail uses on a chat:
 * the link becomes `remove?` at `--danger` and only the second click commits.
 *
 * Pure and tested: the component owns the fetch, this owns the words.
 */
export type RemoveState = "idle" | "confirm" | "busy" | "error";

export type RemoveEvent = "click" | "blur" | "done" | "fail";

/**
 * `click` arms then commits; `blur` disarms (leaving the control puts it back);
 * `done` and `fail` land the request. A click while busy is ignored — the
 * second tap of an impatient user must not fire a second DELETE.
 */
export function nextRemoveState(state: RemoveState, event: RemoveEvent): RemoveState {
  switch (event) {
    case "click":
      if (state === "busy") return "busy";
      return state === "confirm" ? "busy" : "confirm";
    case "blur":
      return state === "confirm" ? "idle" : state;
    case "done":
      return "idle";
    case "fail":
      return "error";
  }
}

/** True only on the transition that should actually call DELETE. */
export function commitsRemove(state: RemoveState, event: RemoveEvent): boolean {
  return event === "click" && state === "confirm";
}

/** Board C vocabulary: lowercase, terse, no apology and no exclamation. */
export function removeLabel(state: RemoveState): string {
  switch (state) {
    case "confirm":
      return "remove?";
    case "busy":
      return "removing…";
    case "error":
      return "that did not go through. try again.";
    default:
      return "remove from log";
  }
}
