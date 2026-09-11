"use client";

/**
 * Onboarding, in the order SPEC v3 fixed: services (six taps) → Letterboxd
 * upload or skip → the deck → done. Chunk D rewrites the flow itself; this is
 * the board C restyle of the page around it.
 *
 * The grammar is the Log board's: one `.section-head` per step, sentence-case
 * lowercase headings, `.t-prose` under them, mono only for figures, `.btn-outline`
 * to confirm and `.t-link` to skip. No accent on this page — nothing here is
 * Play. The step list is a mono index beside a Geist word, never an uppercase
 * tracked label.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { SignInGate } from "@/components/auth/SignInGate";
import { ServicesChecklist } from "@/components/you/ServicesChecklist";
import { LetterboxdImport } from "@/components/you/LetterboxdImport";
import { SwipeDeck, type DeckCard } from "@/components/tonight/SwipeDeck";

const STEPS = ["services", "letterboxd", "the deck", "done"] as const;
/** Board C's "skippable after N": the deck unlocks its confirm at twenty. */
const ENOUGH = 20;

export default function OnboardingPage() {
  return (
    <main className="field h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1000px] px-[16px] pb-[32px] pt-[22px] md:px-[34px]">
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
    <div className="flex flex-col gap-[30px]">
      <div className="section-head">
        <h1 className="t-title">set up</h1>
        <span className="t-prose">what you pay for, what you have seen. two minutes.</span>
        <ol className="ml-auto flex items-baseline gap-[16px]">
          {STEPS.map((label, i) => (
            <li key={label} className={`text-[13px] ${i === step ? "text-ink" : "text-ink-ghost"}`}>
              <span className={`t-meta mr-[6px] ${i === step ? "text-ink-faint" : ""}`}>{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && <ServicesChecklist intro onSaved={() => setStep(1)} />}
      {step === 1 && <LetterboxdImport intro onDone={() => setStep(2)} onSkip={() => setStep(2)} />}
      {step === 2 && <SwipeStep onDone={() => setStep(3)} />}
      {step === 3 && <DoneStep />}
    </div>
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

  const locked = cards === null || (cards.length > 0 && count < ENOUGH);

  return (
    <section className="flex flex-col gap-[18px]">
      <div className="section-head">
        <h2 className="t-title">the deck</h2>
        <span className="t-prose">tap what you think of each. twenty is enough; stop any time after that.</span>
      </div>

      {cards === null && <p className="t-meta">dealing the deck…</p>}
      {cards && cards.length === 0 && <p className="t-prose">nothing to deal right now. you can still go on.</p>}
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

      <div className="flex items-center gap-[16px]">
        <button type="button" onClick={finish} disabled={locked} className="btn btn-outline disabled:opacity-40">
          {locked && cards ? `${ENOUGH - count} more` : "That's enough"}
        </button>
        <button type="button" onClick={finish} className="t-link">
          skip for now
        </button>
      </div>
    </section>
  );
}

// ---- step 4 ----------------------------------------------------------------

function DoneStep() {
  return (
    <section className="flex flex-col gap-[18px]">
      <div className="section-head">
        <h2 className="t-title">that&apos;s enough to start</h2>
        <span className="t-meta">rewrite queued</span>
      </div>
      <p className="t-prose max-w-[880px]">
        it knows what you pay for and what you have seen. every pick from here comes with one real reason out of the graph.
      </p>
      <Link href="/" className="btn btn-outline self-start">
        Go to your page
      </Link>
    </section>
  );
}
