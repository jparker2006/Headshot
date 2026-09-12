"use client";
/**
 * A new account's first three minutes, inline on You — deck first (SPEC v4 →
 * Surfaces: "`/onboarding` becomes the swipe-first empty state of You for a
 * new account"). The deck comes first because it is the only step that makes
 * the profile useful on day one; services and the CSVs follow.
 *
 * No wizard chrome: one heading, one mono step index, one line saying what
 * this step costs, and one `skip for now` in the same place every step. No
 * progress bar, no stepper, no card — the step index is a figure, and a
 * figure is mono (DESIGN.md → Stance). The step's own component draws the
 * content and nothing else: the deck runs headless here so the screen has one
 * 17px heading, not two.
 *
 * The step order and the labels are the pure rules in `swipeRules.ts`.
 */
import { useState } from "react";
import { Imports } from "./Imports";
import { ServicesChecklist } from "./ServicesChecklist";
import { SwipeSession } from "./SwipeSession";
import { bumpLog } from "./logBus";
import { nextStep, stepLabel, type OnboardingStep } from "./swipeRules";

interface Props {
  /** The flow is over; You takes the page. */
  onDone: () => void;
  onSelectNode?: (imdbId: string) => void;
}

/** One line per step, in the house voice: what it is and what it costs. */
const BLURB: Record<OnboardingStep, string> = {
  swipe: "thirty posters, four words each. ten is enough for me to write something about you.",
  services: "what you pay for, so nothing I suggest is behind a wall you do not have.",
  imports: "years of watching, if you already have them in a file. asked once, then never again.",
};

export function Onboarding({ onDone, onSelectNode }: Props) {
  const [step, setStep] = useState<OnboardingStep>("swipe");

  const advance = () => {
    const next = nextStep(step);
    if (next) setStep(next);
    else onDone();
  };

  return (
    <div className="flex flex-col gap-[28px] sm:gap-[38px]" aria-label="Set up">
      {/* One header for the flow: the line, the step figure, and the one way
          past this step — in the same place on every step rather than once in
          the deck's header and once under a button. The last step has no skip
          because `Done` already is one. */}
      <section className="flex flex-col gap-[10px]">
        <div className="flex flex-wrap items-baseline gap-[12px]">
          <h1 className="t-title">nothing in the log yet</h1>
          <span className="t-meta tnum">{stepLabel(step)}</span>
          {step !== "imports" && (
            <button type="button" onClick={advance} className="t-link ml-auto shrink-0">
              skip for now
            </button>
          )}
        </div>
        <p className="t-prose max-w-[880px]">{BLURB[step]}</p>
      </section>

      {/* `heading={null}`: the header above already heads this screen, and a
          second one would push the deck's controls off a phone. */}
      {step === "swipe" && (
        <SwipeSession heading={null} exitLabel="what you pay for" onExit={advance} onSelectNode={onSelectNode} />
      )}

      {step === "services" && <ServicesChecklist intro onSaved={advance} />}

      {step === "imports" && (
        <div className="flex flex-col gap-[22px]">
          <Imports onDone={bumpLog} />
          <button type="button" onClick={onDone} className="btn btn-outline self-start">
            Done
          </button>
        </div>
      )}
    </div>
  );
}
