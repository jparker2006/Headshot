"use client";
/**
 * One prompt sits at the bottom of every screen (DESIGN.md → You → Log field),
 * which puts it outside the You column in the React tree. This is how the two
 * talk: the prompt bumps a counter after it writes a row, and every section
 * that reads the log re-fetches. A module-level store rather than context, so
 * nothing between them has to know they are related.
 */
import { useSyncExternalStore } from "react";

let version = 0;
const listeners = new Set<() => void>();

/** Something wrote to the log (a row logged, an import finished). */
export function bumpLog(): void {
  version += 1;
  for (const l of [...listeners]) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => version;

/** Re-renders whenever the log changes. Use it as a fetch key. */
export function useLogVersion(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
