"use client";
/**
 * Step three: one round of ten from the catch-up deck, which is the same
 * component the Log page opens inline — onboarding links to it, it is never a
 * fork of it (SPEC v5 → Catch-up deck).
 */
import { useRouter } from "next/navigation";
import { CatchUp } from "@/components/you/CatchUp";
import { WelcomeStep } from "@/components/welcome/WelcomeStep";
import { WELCOME_DONE } from "@/components/welcome/welcomeModel";

export default function WelcomeCatchUp() {
  const router = useRouter();
  return (
    <WelcomeStep step="catch-up" title="ten you have probably seen" line="rate the ones you know, skip the ones you do not. ten and you are in." wide>
      <CatchUp onDone={() => router.push(WELCOME_DONE)} onSelectNode={() => {}} />
    </WelcomeStep>
  );
}
