import { redirect } from "next/navigation";

/**
 * Onboarding is no longer a page. A new account's first three minutes are the
 * deck-first empty state of You (SPEC v4 → Surfaces: "`/onboarding` becomes
 * the swipe-first empty state of You for a new account"), so this route only
 * exists to send old links and old bookmarks home.
 */
export default function OnboardingPage() {
  redirect("/");
}
