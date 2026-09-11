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
    return <span className="t-meta">…</span>;
  }
  if (!user) {
    return (
      <button
        onClick={() => requireSignIn(typeof window === "undefined" ? "/" : window.location.pathname)}
        className="t-meta text-left text-ink-faint transition-colors duration-[120ms] hover:text-ink"
      >
        sign in
      </button>
    );
  }
  return (
    <div className="flex items-center gap-[14px]">
      <span className="t-meta min-w-0 flex-1 truncate text-ink-faint">{user.email ?? "signed in"}</span>
      <button
        onClick={() => void signOut()}
        className="t-link shrink-0"
      >
        sign out
      </button>
    </div>
  );
}
