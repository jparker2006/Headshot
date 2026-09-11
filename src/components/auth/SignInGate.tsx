"use client";

/**
 * The client half of accounts. Sign-in is opt-in (SPEC v3): nothing here is
 * allowed to block Headshot's chat, the brain, or a permalink. It appears at
 * the first thing that needs a user — a swipe, an import, "I watched it".
 */
import { useCallback, useSyncExternalStore } from "react";
import { authClient } from "@/lib/auth/client";
import { meStore } from "./meStore";

export interface SessionUser {
  id: string;
  email: string | null;
}

/** Where to send the browser to sign in and come back to `next`. */
export function signInHref(next: string): string {
  return `/auth/sign-in?next=${encodeURIComponent(next || "/")}`;
}

/**
 * Send the user to sign in, returning here afterwards. A plain navigation
 * rather than a router push: the magic link lands in a different tab, so the
 * state of this one is not worth preserving.
 */
export function requireSignIn(next: string): void {
  // A full navigation on purpose: the magic link opens a new document (often a
  // new tab), so nothing in this one is worth carrying across, and this helper
  // is called from plain callbacks that have no router in scope.
  window.location.assign(signInHref(next));
}

/**
 * The signed-in user, or null. `loading` is true only for the first fetch, so
 * a signed-out user never sees a flash of "Sign in" replaced by their email.
 */
export function useSessionUser(): { user: SessionUser | null; loading: boolean } {
  const session = authClient.useSession() as {
    data?: { user?: { id?: string; email?: string } } | null;
    isPending?: boolean;
  };
  const raw = session.data?.user;
  const me = useSyncExternalStore(meStore.subscribe, meStore.getSnapshot, meStore.getServerSnapshot);
  const user = raw?.id ? { id: raw.id, email: raw.email ?? null } : me.user;
  return { user, loading: (Boolean(session.isPending) || me.loading) && !user };
}

/** Sign out and return to the home screen, which works signed out. */
export async function signOut(): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    // A hard reload, not a router push: signing out has to drop every piece of
    // per-user state the client is holding, not just re-render the tree.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }
}

/** True once the component has hydrated; keeps the server HTML signed-out. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

interface GateProps {
  /** Where to come back to after the magic link. */
  next: string;
  children: (user: SessionUser) => React.ReactNode;
  /** One line explaining what signing in unlocks. */
  reason?: string;
}

/**
 * Renders `children` for a signed-in user, and otherwise the one-line reason
 * plus a sign-in button. Used by the onboarding screens, never by the home
 * screen: Headshot itself is anonymous.
 */
export function SignInGate({ next, children, reason }: GateProps) {
  const hydrated = useHydrated();
  const { user, loading } = useSessionUser();
  const go = useCallback(() => requireSignIn(next), [next]);

  if (!hydrated || loading) {
    return <span className="t-meta">checking…</span>;
  }
  if (!user) {
    return (
      <div className="flex flex-col items-start gap-[22px]">
        <p className="t-prose max-w-[62ch]">
          {reason ?? "Your taste is private and tied to an account. Headshot itself stays open — this is only for the part that remembers you."}
        </p>
        <button
          onClick={go}
          className="btn btn-outline"
        >
          Sign in
        </button>
      </div>
    );
  }
  return <>{children(user)}</>;
}
