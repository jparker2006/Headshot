"use client";

/**
 * Onboarding, in the order SPEC v3 fixed: services (six taps) → Letterboxd
 * upload or skip → Tonight. The swipe deck is chunk C and slots in before the
 * last step. Styled against DESIGN.md: hairlines, no cards, one accent, space
 * instead of borders.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { SignInGate } from "@/components/auth/SignInGate";
import { ServicesChecklist } from "@/components/you/ServicesChecklist";
import { LetterboxdImport } from "@/components/you/LetterboxdImport";
import { SwipeDeck, type DeckCard } from "@/components/tonight/SwipeDeck";

const STEPS = ["Services", "Letterboxd", "Deck", "Tonight"] as const;

export default function OnboardingPage() {
  return (
    <main className="field h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[680px] px-5 py-12 sm:px-10">
        <SignInGate next="/onboarding" reason="Your taste is private and lives with an account. Headshot's chat and the shared brain stay open without one.">
          {() => <Onboarding />}
        </SignInGate>
      </div>
    </main>
  );
}

function Onboarding() {
  const [step, setStep] = useState(0);

  return (
    <>
      <ol className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.08em]">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? "text-ink" : "text-ink-faint"}>
            <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span> {label}
          </li>
        ))}
      </ol>
      <div className="mt-5 h-px bg-line" />

      {step === 0 && <ServicesChecklist intro onSaved={() => setStep(1)} />}
      {step === 1 && <LetterboxdImport intro onDone={() => setStep(2)} onSkip={() => setStep(2)} />}
      {step === 2 && <SwipeStep onDone={() => setStep(3)} />}
      {step === 3 && <DoneStep />}
    </>
  );
}

// ---- step 3: the swipe deck -------------------------------------------------

function SwipeStep({ onDone }: { onDone: () => void }) {
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch("/api/taste/deck", { cache: "no-store" });
      if (!r.ok) {
        if (alive) setCards([]);
        return;
      }
      const { cards } = (await r.json()) as { cards: { imdbId: string; name: string; year: number }[] };
      const base: DeckCard[] = cards.map((c) => ({ ...c, posterUrl: null }));
      if (alive) setCards(base);
      // Posters, forty ids per call, best effort.
      const ids = cards.map((c) => c.imdbId);
      const images: Record<string, string | null> = {};
      for (let i = 0; i < ids.length; i += 40) {
        try {
          const d = (await (await fetch(`/api/enrich?ids=${ids.slice(i, i + 40).join(",")}`)).json()) as { images: Record<string, { url: string | null }> };
          for (const [k, v] of Object.entries(d.images)) images[k] = v.url;
        } catch {
          /* posters are optional */
        }
      }
      if (alive) setCards(base.map((c) => ({ ...c, posterUrl: images[c.imdbId] ?? null })));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const finish = () => {
    // Picks are computed now so Tonight is ready when the user lands on it.
    void fetch("/api/tonight/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
    onDone();
  };

  return (
    <section className="mt-8">
      <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-balance text-ink">Fifty quick ones</h1>
      <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-dim">
        Tap what you think of each. Nothing you skip counts. Twenty is enough to start; you can stop any time after that.
      </p>
      <div className="mt-8">
        {cards === null && <p className="font-mono text-[11px] text-ink-faint">dealing the deck…</p>}
        {cards && cards.length === 0 && <p className="text-[13px] text-ink-dim">Nothing to deal right now. You can still go on.</p>}
        {cards && cards.length > 0 && (
          <SwipeDeck
            key={cards.map((c) => c.imdbId).join(",")}
            cards={cards}
            onCommit={(rows) => {
              setCount(rows.length);
              void fetch("/api/taste/swipe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows }) }).catch(() => {});
            }}
            onDone={finish}
          />
        )}
      </div>
      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={finish}
          disabled={cards === null || (cards.length > 0 && count < 20)}
          className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-[13.5px] font-semibold text-bg transition-[filter] duration-[120ms] hover:brightness-110 disabled:opacity-40"
        >
          {count < 20 && cards && cards.length > 0 ? `${20 - count} more to unlock` : "That's enough"}
        </button>
        <button type="button" onClick={finish} className="font-mono text-[11px] text-ink-faint hover:text-ink">
          skip for now
        </button>
      </div>
    </section>
  );
}

// ---- step 4 ----------------------------------------------------------------

function DoneStep() {
  return (
    <section className="mt-8">
      <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-balance text-ink">That&apos;s enough to start</h1>
      <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-dim">
        It knows what you pay for and what you have seen. Every pick from here comes with one real reason out of the graph.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center rounded-full bg-accent px-5 text-[13.5px] font-semibold text-bg transition-[filter] duration-[120ms] hover:brightness-110"
      >
        Go to Tonight
      </Link>
    </section>
  );
}
