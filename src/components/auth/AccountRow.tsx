"use client";

/**
 * The account item at the bottom of the rail: "Sign in" when signed out,
 * "you@… · sign out" when signed in. Deliberately the quietest thing in the
 * sidebar — Headshot works signed out, so this must never look like a wall.
 */
import { requireSignIn, signOut, useSessionUser } from "./SignInGate";

export function AccountRow() {
  const { user, loading } = useSessionUser();

  if (loading) {
    return <div className="font-mono text-[11.5px] text-ink-faint">…</div>;
  }
  if (!user) {
    return (
      <button
        onClick={() => requireSignIn(typeof window === "undefined" ? "/" : window.location.pathname)}
        className="text-left text-[13px] text-ink-dim transition-colors duration-[120ms] hover:text-ink"
      >
        Sign in
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="min-w-0 flex-1 truncate text-ink-dim">{user.email ?? "Signed in"}</span>
      <button
        onClick={() => void signOut()}
        className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint transition-colors duration-[120ms] hover:text-ink"
      >
        Sign out
      </button>
    </div>
  );
}
