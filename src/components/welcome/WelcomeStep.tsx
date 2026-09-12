"use client";
/**
 * One onboarding step: the wordmark, one 560px column, a `.t-title` header,
 * one `.t-meta` line saying where you are, the step's own control, and `skip`
 * as a `.t-link`. No progress bar, no illustration, no second paragraph —
 * every step is one line of copy because the whole thing has to fit in a
 * minute (SPEC v5 → Onboarding).
 *
 * The rail is deliberately absent: there is nothing to navigate to yet.
 */
import Link from "next/link";
import { useEffect } from "react";
import { requireSignIn, useSessionUser } from "@/components/auth/SignInGate";
import { skipHref, stepLabel, type WelcomeStep as Step } from "./welcomeModel";

interface Props {
  step: Step;
  /** The header, lowercase, one line. */
  title: string;
  /** One line under it. Optional — some steps say it all in the title. */
  line?: string;
  children: React.ReactNode;
  /** `skip` goes where `next` goes; a step with nothing to skip omits it. */
  skippable?: boolean;
  /** The whole column, for a step that needs more than 560px (the deck). */
  wide?: boolean;
}

export function WelcomeStep({ step, title, line, children, skippable = true, wide = false }: Props) {
  // Every step writes to the signed-in user's own store, so there is nothing
  // to show a stranger: send them to sign in and back to this exact step.
  const { user, loading } = useSessionUser();
  useEffect(() => {
    if (!loading && !user) requireSignIn(`/welcome/${step}`);
  }, [loading, user, step]);

  return (
    <main className="flex h-full w-full flex-col overflow-y-auto bg-bg">
      <div className="px-4 pt-[22px] md:px-[34px]">
        <span className="text-[14px] font-bold leading-none tracking-[-0.02em] text-ink">headshot</span>
      </div>

      {/* Centred, the way sign-in is — onboarding uses the sign-in grammar and
          a step is one short column, not a page with a pile of air under it. */}
      <div className="flex flex-1 items-center justify-center px-4 py-[56px] md:px-[34px]">
        {/* The deck's own column is 420px, so a wide step is 420 too: the
            header, the card and `skip` then share one left edge. */}
        <div className={`flex w-full flex-col gap-[22px] ${wide ? "max-w-[420px]" : "max-w-[560px]"}`}>
          <div className="flex flex-wrap items-baseline gap-[12px]">
            <h1 className="t-title">{title}</h1>
            <span className="t-meta ml-auto shrink-0">{stepLabel(step)}</span>
          </div>
          {line && <p className="t-prose">{line}</p>}

          {user ? children : <p className="t-meta">{loading ? "…" : "sending you to sign in…"}</p>}

          {user && skippable && (
            <Link href={skipHref(step)} className="tap self-start">
              <span className="t-link">skip</span>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
