/**
 * Onboarding, as three facts (SPEC v5 → Onboarding): the order of the steps,
 * where each one goes next — which is also where its `skip` goes, because
 * skipping a step is finishing it with nothing — and the one rule that decides
 * whether a signed-in person sees any of it.
 *
 * Pure, so `tests/client/welcomeModel.test.ts` can hold it to account without
 * a router. Under a minute is the target: three steps, one line each.
 */

export const WELCOME_STEPS = ["services", "letterboxd", "catch-up"] as const;
export type WelcomeStep = (typeof WELCOME_STEPS)[number];

/** Where onboarding ends: the Log, which is the product. */
export const WELCOME_DONE = "/";

/** 1-based, for `step 2 of 3`. */
export function stepNumber(step: WelcomeStep): number {
  return WELCOME_STEPS.indexOf(step) + 1;
}

/** `step 2 of 3` — one `.t-meta` line, the only progress chrome there is. */
export function stepLabel(step: WelcomeStep): string {
  return `step ${stepNumber(step)} of ${WELCOME_STEPS.length}`;
}

/** The next step's route; the last step's next is the Log. */
export function nextHref(step: WelcomeStep): string {
  const at = WELCOME_STEPS.indexOf(step);
  const next = WELCOME_STEPS[at + 1];
  return next ? `/welcome/${next}` : WELCOME_DONE;
}

/** Skipping is finishing with nothing, so it goes exactly where next goes. */
export function skipHref(step: WelcomeStep): string {
  return nextHref(step);
}

/** The localStorage key that stops onboarding ever running twice. */
export const WELCOMED_KEY = "headshot:welcomed";

export interface WelcomeCheck {
  /** Null while the session is still resolving, or signed out. */
  userId: string | null;
  /** What `headshot:welcomed` holds, if anything. */
  welcomed: string | null;
  /** How many rows are in the log. */
  watchedCount: number;
  /** Whether the account has ever saved a services row. */
  hasServices: boolean;
}

/**
 * There is no server-side "is this a new user", so a new user is one with an
 * empty log and no services — and remembering that we sent them once is what
 * keeps a person who genuinely has nothing logged from being sent to
 * onboarding on every visit.
 */
export function shouldWelcome({ userId, welcomed, watchedCount, hasServices }: WelcomeCheck): boolean {
  if (!userId) return false;
  if (welcomed === userId) return false;
  return watchedCount === 0 && !hasServices;
}
