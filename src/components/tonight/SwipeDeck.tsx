"use client";
/**
 * The swipe deck: one poster at a time, four actions, undo always. Drives the
 * pure reducer in src/lib/picks/swipe and posts committed rows through
 * `onCommit`. Thumb-sized on a phone, keyboard on a laptop (1-4, z to undo).
 */
import { useEffect, useReducer, useState } from "react";
import { committedRows, initialSwipeState, swipeReducer, type SwipeAction } from "@/lib/picks/swipe";

export interface DeckCard {
  imdbId: string;
  name: string;
  year: number;
  posterUrl: string | null;
  /** Why it is in the deck, one line. */
  hint?: string;
}

interface Props {
  cards: DeckCard[];
  /** Persist the current committed rows (called after every change, debounced by the caller if needed). */
  onCommit: (rows: { imdbId: string; rating: SwipeAction }[]) => void;
  onSelectNode?: (imdbId: string) => void;
  onDone?: () => void;
}

const ACTIONS: { action: SwipeAction; label: string; key: string }[] = [
  { action: "liked", label: "liked it", key: "1" },
  { action: "meh", label: "seen it, meh", key: "2" },
  { action: "unseen", label: "never seen", key: "3" },
  { action: "want", label: "want to", key: "4" },
];

export function SwipeDeck({ cards, onCommit, onSelectNode, onDone }: Props) {
  const [state, dispatch] = useReducer(swipeReducer, cards.map((c) => c.imdbId), initialSwipeState);
  const [leaving, setLeaving] = useState<SwipeAction | null>(null);
  const byId = new Map(cards.map((c) => [c.imdbId, c]));
  const top = state.remaining[0] ? byId.get(state.remaining[0]) : undefined;
  const done = cards.length - state.remaining.length;

  const act = (action: SwipeAction) => {
    if (!top) return;
    setLeaving(action);
    const next = swipeReducer(state, { type: "swipe", action });
    dispatch({ type: "swipe", action });
    onCommit(committedRows(next));
    setTimeout(() => setLeaving(null), 300);
    if (next.remaining.length === 0) onDone?.();
  };
  const undo = () => {
    const next = swipeReducer(state, { type: "undo" });
    dispatch({ type: "undo" });
    onCommit(committedRows(next));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const a = ACTIONS.find((x) => x.key === e.key);
      if (a) act(a.action);
      else if (e.key === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!top) {
    return (
      <div className="space-y-2 py-6 text-center">
        <p className="text-[15px] text-ink">that&apos;s the deck. {done} taught me something.</p>
        {state.swipes.length > 0 && (
          <button type="button" onClick={undo} className="font-mono text-[11px] text-ink-faint hover:text-ink">
            undo last
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4" aria-label="Swipe deck">
      <div className="flex w-full items-baseline justify-between font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
        <span>
          {done + 1} of {cards.length}
        </span>
        <button type="button" onClick={undo} disabled={state.swipes.length === 0} className="normal-case tracking-normal hover:text-ink disabled:opacity-40">
          undo (z)
        </button>
      </div>
      <button
        type="button"
        onClick={() => onSelectNode?.(top.imdbId)}
        className={`relative aspect-[3/4] w-[220px] overflow-hidden rounded-[14px] bg-white/[0.05] ring-1 ring-line transition duration-300 ease-out ${
          leaving === "liked" || leaving === "want" ? "translate-x-16 rotate-6 opacity-0" : leaving ? "-translate-x-16 -rotate-6 opacity-0" : ""
        }`}
        title={top.hint ?? top.name}
      >
        {top.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={top.posterUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/95 to-transparent px-3 pb-3 pt-10 text-left">
          <span className="block text-[18px] font-semibold leading-tight text-ink">{top.name}</span>
          <span className="block font-mono text-[10.5px] text-ink-dim">{top.year || ""}</span>
        </span>
      </button>
      {top.hint && <p className="max-w-[36ch] text-center text-[12.5px] text-ink-dim">{top.hint}</p>}
      <div className="grid w-full max-w-[420px] grid-cols-4 gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.action}
            type="button"
            onClick={() => act(a.action)}
            className={`h-11 rounded-full border text-[12px] transition ${
              a.action === "liked" || a.action === "want" ? "border-accent/40 text-ink hover:bg-accent/20" : "border-line text-ink-dim hover:text-ink"
            }`}
          >
            {a.label} <span className="font-mono text-[10px] text-ink-faint">{a.key}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
