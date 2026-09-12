"use client";
/**
 * Send a brand-new account through `/welcome` once (SPEC v5 → Onboarding).
 *
 * There is no server-side "is this a new user" — magic-link sign-in hands back
 * a session and nothing else — so the client asks the two questions that make
 * the same answer: is the log empty, and have they never saved a service? Both
 * yes and we have not sent them before, and the shell goes to the first step.
 * The visit is remembered in localStorage under `headshot:welcomed` so a
 * person who deliberately has nothing logged is never sent twice.
 *
 * The rule itself is `shouldWelcome` in `welcomeModel.ts`, tested there.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { shouldWelcome, WELCOMED_KEY } from "./welcomeModel";

function read(): string | null {
  try {
    return window.localStorage.getItem(WELCOMED_KEY);
  } catch {
    return null;
  }
}

function remember(userId: string) {
  try {
    window.localStorage.setItem(WELCOMED_KEY, userId);
  } catch {
    /* a private window still gets onboarding; it just gets it again */
  }
}

export function useWelcomeRedirect(userId: string | null): void {
  const asked = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!userId || asked.current === userId) return;
    asked.current = userId;
    const welcomed = read();
    if (welcomed === userId) return;

    let alive = true;
    void (async () => {
      const [watched, services] = await Promise.all([
        fetch("/api/taste/watched", { cache: "no-store" })
          .then(async (r) => (r.ok ? ((await r.json()) as { watched: unknown[] }).watched.length : 1))
          .catch(() => 1),
        fetch("/api/taste/services", { cache: "no-store" })
          .then(async (r) => (r.ok ? ((await r.json()) as { providerIds: number[] }).providerIds.length > 0 : true))
          .catch(() => true),
      ]);
      if (!alive) return;
      if (!shouldWelcome({ userId, welcomed, watchedCount: watched, hasServices: services })) return;
      // Remembered before the navigation, not after: a person who backs out of
      // onboarding has still been offered it.
      remember(userId);
      router.replace("/welcome/services");
    })();

    return () => {
      alive = false;
    };
  }, [userId, router]);
}
