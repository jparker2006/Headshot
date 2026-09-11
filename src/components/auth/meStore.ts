"use client";
/**
 * The server's view of who is signed in, fetched once per page load through
 * /api/me. It backs `useSessionUser` alongside the auth client's own session,
 * so the dev override (HEADSHOT_DEV_USER) and any server-only session state
 * reach the client without a second auth round trip per component.
 */
import type { SessionUser } from "./SignInGate";

type Snapshot = { user: SessionUser | null; loading: boolean };

const SERVER_SNAPSHOT: Snapshot = { user: null, loading: true };
let snapshot: Snapshot = SERVER_SNAPSHOT;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function start() {
  if (started) return;
  started = true;
  fetch("/api/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { user: null }))
    .then((d: { user: SessionUser | null }) => {
      snapshot = { user: d.user ?? null, loading: false };
      emit();
    })
    .catch(() => {
      snapshot = { user: null, loading: false };
      emit();
    });
}

export const meStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    start();
    return () => {
      listeners.delete(fn);
    };
  },
  getSnapshot: () => snapshot,
  getServerSnapshot: () => SERVER_SNAPSHOT,
};
