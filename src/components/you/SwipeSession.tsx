"use client";
/**
 * A swipe session: thirty cards, four buckets, undo — then one write, one
 * memory rewrite, and the diff (SPEC v4 → Swipe as lore).
 *
 * The session is the unit, not the card. Nothing is persisted while you swipe;
 * at the end the committed rows go to `POST /api/taste/swipe/session`, which
 * writes them, logs one episode, awaits the rewrite and hands back the line
 * diff. That takes the better part of half a minute, so the wait is one
 * `.t-meta` line with the thread's three pulsing middots after it — board C
 * has no spinners, and those dots are its only "working" device.
 *
 * It lives inline on You (`mode: "swipe"`) and as step one of a new account's
 * deck-first onboarding. There is no route: the deck is a state of You.
 */
import { useCallback, useEffect, useState } from "react";
import { useImages } from "@/components/chat/useImages";
import { SwipeDeck, type DeckCard } from "@/components/tonight/SwipeDeck";
import type { SwipeAction } from "@/lib/picks/swipe";
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
  onSelectNode?: (imdbId: string) => void;
  /** Leave the session: back to You, or on to the next onboarding step. */
  onExit: () => void;
  /** What the diff's exit button says. */
  exitLabel?: string;
  /**
   * The section heading. `null` draws no header at all: onboarding already
   * heads the screen with the step, and a second 17px heading over the same
   * column both repeats itself and pushes the deck's own controls under the
   * composer on a phone.
   */
  heading?: string | null;
}

type Phase =
  | { kind: "dealing" }
  | { kind: "empty" }
  | { kind: "deck" }
  | { kind: "saving" }
  | { kind: "done"; result: SessionResult }
  | { kind: "failed" };

/** What the session route takes: one row per card the user actually rated. */
type Row = { imdbId: string; rating: SwipeAction };

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
    <p className="t-meta">
      {children}
      <span className="thinking-dot"> ·</span>
      <span className="thinking-dot">·</span>
      <span className="thinking-dot">·</span>
    </p>
  );
}

export function SwipeSession({ onSelectNode, onExit, exitLabel, heading = "the deck" }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "dealing" });
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [mode, setMode] = useState<DeckMode>("cold");
  // A fresh key resets the reducer inside the deck when "keep swiping" deals again.
  const [session, setSession] = useState(0);

  /**
   * Deal a session. The reset to "dealing" is done by whoever asks for a new
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

  /** "keep swiping" and "Deal again": back to the top with a fresh deck. */
  const again = () => {
    setPhase({ kind: "dealing" });
    setCards([]);
    setSession((s) => s + 1);
  };

  /** Posters: one `/api/enrich` call for the deck, cached for the tab. */
  const images = useImages(cards.map((c) => c.imdbId));
  const dealtCards = cards.map((c) => ({ ...c, posterUrl: c.posterUrl ?? images[c.imdbId]?.url ?? null }));

  const finish = useCallback(
    async (rows: Row[]) => {
      if (rows.length === 0) {
        onExit();
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
        // The log, the numbers and tonight all moved; You re-reads them.
        bumpLog();
        void fetch("/api/tonight/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
        setPhase({ kind: "done", result });
      } catch {
        setPhase({ kind: "failed" });
      }
    },
    [onExit],
  );

  if (phase.kind === "done") {
    return (
      <MemoryDiff
        diff={phase.result.diff}
        after={phase.result.after}
        rewritten={phase.result.rewritten}
        onExit={onExit}
        exitLabel={exitLabel}
        onAgain={again}
        onSelectNode={onSelectNode}
      />
    );
  }

  return (
    <section className="flex flex-col gap-[18px]" aria-label="Swipe session">
      {heading !== null && (
        <div className="section-head">
          <h2 className="t-title">{heading}</h2>
          {/* where the thirty came from — a fact about the deck, so it waits
              for the deck rather than guessing at `cold` while it deals and
              then sitting over a wait or a diff once it has gone. */}
          {phase.kind === "deck" && <span className="t-sub hidden sm:inline">{deckBlurb(mode)}</span>}
        </div>
      )}

      {phase.kind === "dealing" && <Waiting>dealing the deck</Waiting>}
      {phase.kind === "empty" && (
        <div className="flex flex-col items-start gap-[12px]">
          <p className="t-prose">nothing left to deal. you have rated everything I know to ask about.</p>
          <button type="button" onClick={onExit} className="btn btn-outline">
            {exitLabel ?? "back to you"}
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
            <button type="button" onClick={onExit} className="t-link">
              {exitLabel ?? "back to you"}
            </button>
          </div>
        </div>
      )}
      {phase.kind === "saving" && <Waiting>rewriting what I know about you</Waiting>}
      {phase.kind === "deck" && (
        <SwipeDeck
          key={`${session}-${cards.length}`}
          cards={dealtCards}
          onFinish={(rows) => void finish(rows)}
          onSelectNode={onSelectNode}
        />
      )}
    </section>
  );
}
