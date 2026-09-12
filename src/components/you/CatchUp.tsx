"use client";
/**
 * Catch-up: rounds of ten cards, "seen it" → the row of ten or "not seen",
 * then one write, one memory rewrite and the diff (SPEC v5 → Catch-up deck).
 *
 * The round is the unit, not the card. Nothing is persisted while you answer;
 * at the end the committed rows go to `POST /api/taste/swipe/session`, which
 * writes them, logs one episode, awaits the rewrite and hands back the line
 * diff. That takes the better part of half a minute, so the wait is one
 * `.t-prose` line with the thread's three pulsing middots after it — board C
 * has no spinners, and those dots are its only "working" device.
 *
 * There is no floor: "done for now" is live from the first card, the rewrite
 * runs on whatever was committed, and a round with nothing committed simply
 * goes back to the log. It is never onboarding — `/welcome` links to it.
 *
 * It has no route: the Log page opens it inline in its own place.
 */
import { useCallback, useEffect, useState } from "react";
import { useImages } from "@/components/chat/useImages";
import { SwipeDeck, type DeckCard } from "@/components/tonight/SwipeDeck";
import type { WatchedRating } from "@/lib/taste/types";
import { MemoryDiff } from "./MemoryDiff";
import { bumpLog } from "./logBus";
import { SESSION_SIZE, deckBlurb, type DeckMode, type MemoryDiffLines } from "./swipeRules";

interface SessionResult {
  before: string;
  after: string;
  diff: MemoryDiffLines;
  rewritten: boolean;
}

interface Props {
  /** Leave catch-up: back to the log. */
  onDone: () => void;
  onSelectNode: (imdbId: string) => void;
}

type Phase =
  | { kind: "dealing" }
  | { kind: "empty" }
  | { kind: "deck" }
  | { kind: "saving" }
  | { kind: "done"; result: SessionResult }
  | { kind: "failed" };

/** What the session route takes: one row per card the user actually answered. */
type Row = { imdbId: string; rating: WatchedRating; score: number | null };

/**
 * A wait, in the one grammar the app already has for it: the line plus the
 * three pulsing middots the thread uses while the agent thinks (`ChatPanel`).
 * The rewrite takes the better part of half a minute, and a single static
 * ghost line on an otherwise empty screen reads as a page that has died.
 * Board C has no spinners; these dots are the whole vocabulary, and
 * `prefers-reduced-motion` already stops them in `globals.css`.
 */
function Waiting({ children }: { children: string }) {
  return (
    // `.t-prose`, not `.t-meta`: this line is the only thing on the screen for
    // the better part of half a minute, and the ghost ink reads as a dead page.
    <p className="t-prose">
      {children}
      <span className="thinking-dot"> ·</span>
      <span className="thinking-dot">·</span>
      <span className="thinking-dot">·</span>
    </p>
  );
}

export function CatchUp({ onDone, onSelectNode }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "dealing" });
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [mode, setMode] = useState<DeckMode>("cold");
  // A fresh key resets the reducer inside the deck when "ten more" deals again.
  const [session, setSession] = useState(0);

  /**
   * Deal a round. The reset to "dealing" is done by whoever asks for a new
   * one, not here, so the effect never sets state synchronously.
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/taste/deck?size=${SESSION_SIZE}`, { cache: "no-store" });
        if (!alive) return;
        if (!r.ok) {
          setPhase({ kind: "failed" });
          return;
        }
        const body = (await r.json()) as { cards?: DeckCard[]; mode?: DeckMode };
        if (!alive) return;
        const dealt = body.cards ?? [];
        setMode(body.mode === "lore" ? "lore" : "cold");
        setCards(dealt);
        setPhase({ kind: dealt.length > 0 ? "deck" : "empty" });
      } catch {
        if (alive) setPhase({ kind: "failed" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [session]);

  /** "ten more" and "Deal again": back to the top with a fresh ten. */
  const again = () => {
    setPhase({ kind: "dealing" });
    setCards([]);
    setSession((s) => s + 1);
  };

  /** Posters: one `/api/enrich` call for the round, cached for the tab. */
  const images = useImages(cards.map((c) => c.imdbId));
  const dealtCards = cards.map((c) => ({ ...c, posterUrl: c.posterUrl ?? images[c.imdbId]?.url ?? null }));

  const finish = useCallback(
    async (rows: Row[]) => {
      // Nothing answered: there is nothing to write and nothing to rewrite.
      if (rows.length === 0) {
        onDone();
        return;
      }
      setPhase({ kind: "saving" });
      try {
        const r = await fetch("/api/taste/swipe/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rows }),
        });
        if (!r.ok) {
          setPhase({ kind: "failed" });
          return;
        }
        const result = (await r.json()) as SessionResult;
        // The log and the numbers moved; the Log page re-reads them.
        bumpLog();
        setPhase({ kind: "done", result });
      } catch {
        setPhase({ kind: "failed" });
      }
    },
    [onDone],
  );

  if (phase.kind === "done") {
    return (
      <MemoryDiff
        diff={phase.result.diff}
        after={phase.result.after}
        rewritten={phase.result.rewritten}
        onExit={onDone}
        onAgain={again}
        onSelectNode={onSelectNode}
      />
    );
  }

  return (
    <section className="flex flex-col gap-[18px]" aria-label="Catch up">
      {phase.kind === "dealing" && <Waiting>dealing the deck</Waiting>}
      {phase.kind === "empty" && (
        <div className="flex flex-col items-start gap-[12px]">
          <p className="t-prose">nothing left to deal. you have rated everything I know to ask about.</p>
          <button type="button" onClick={onDone} className="btn btn-outline">
            back to the log
          </button>
        </div>
      )}
      {phase.kind === "failed" && (
        <div className="flex flex-col items-start gap-[12px]">
          <p className="t-prose">the deck did not come back. try again in a moment.</p>
          {/* a retry and a way out: an error that can only be retried is a
              dead end if it keeps failing. */}
          <div className="flex flex-wrap items-center gap-[18px]">
            <button type="button" onClick={again} className="btn btn-outline">
              Deal again
            </button>
            <button type="button" onClick={onDone} className="t-link">
              back to the log
            </button>
          </div>
        </div>
      )}
      {phase.kind === "saving" && <Waiting>rewriting what I know about you</Waiting>}
      {phase.kind === "deck" && (
        <>
          {/* where the ten came from — a fact about the deck, so it waits for
              the deck rather than sitting over a wait or a diff. */}
          <p className="t-sub mx-auto hidden w-full max-w-[420px] text-center sm:block">{deckBlurb(mode)}</p>
          <SwipeDeck
            key={`${session}-${cards.length}`}
            cards={dealtCards}
            onFinish={(rows) => void finish(rows)}
            onSelectNode={onSelectNode}
          />
        </>
      )}
    </section>
  );
}
