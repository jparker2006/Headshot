"use client";
/**
 * The swipe deck, rebuilt against DESIGN.md § Swipe deck.
 *
 * Posters are the only colour in board C, so here the poster *is* the screen:
 * 260×390, no radius, no shadow, no card behind it. Everything around it stays
 * at the board's scale — the title as `.t-row` at 16/600 over one mono facts
 * line, the log field's four bucket buttons at 44px across a 420px row with
 * mono `1 2 3 4` under them, the progress as a mono figure top-right, `undo`
 * and `skip` as `.t-link`s bottom-left. A card leaving is a 300ms translate and
 * fade with a 2° rotation: no colour overlay, no stamp.
 *
 * State is the pure reducer in src/lib/picks/swipe; committed rows go out
 * through `onCommit`. Keyboard: 1-4, z to undo, s to skip.
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

/** The buckets in the log field's order and words. No colour, no accent. */
const ACTIONS: { action: SwipeAction; label: string; key: string }[] = [
  { action: "liked", label: "liked", key: "1" },
  { action: "meh", label: "meh", key: "2" },
  { action: "want", label: "want", key: "3" },
  { action: "unseen", label: "seen", key: "4" },
];

export function SwipeDeck({ cards, onCommit, onSelectNode, onDone }: Props) {
  const [state, dispatch] = useReducer(swipeReducer, cards.map((c) => c.imdbId), initialSwipeState);
  const [leaving, setLeaving] = useState<SwipeAction | null>(null);
  const byId = new Map(cards.map((c) => [c.imdbId, c]));
  const top = state.remaining[0] ? byId.get(state.remaining[0]) : undefined;
  const done = state.swipes.length;

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
  const skip = () => dispatch({ type: "skip" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const a = ACTIONS.find((x) => x.key === e.key);
      if (a) act(a.action);
      else if (e.key === "z") undo();
      else if (e.key === "s") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!top) {
    return (
      <div className="flex flex-col gap-[10px] py-6" aria-label="Swipe deck">
        <p className="t-note">that&apos;s the deck.</p>
        <p className="t-meta">
          {done} rated · nothing you skipped counts
        </p>
        {state.swipes.length > 0 && (
          <button type="button" onClick={undo} className="t-link self-start">
            undo
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-[18px]" aria-label="Swipe deck">
      {/* the progress, as a mono figure */}
      <div className="flex w-full items-baseline">
        <span className="t-meta ml-auto">
          {done + 1} / {cards.length}
        </span>
      </div>

      {/* the poster is the screen */}
      <button
        type="button"
        onClick={() => onSelectNode?.(top.imdbId)}
        title={top.hint ?? top.name}
        className={`block h-[390px] w-[260px] shrink-0 overflow-hidden bg-raised transition duration-300 ease-out ${
          leaving === "liked" || leaving === "want" ? "translate-x-12 rotate-2 opacity-0" : leaving ? "-translate-x-12 -rotate-2 opacity-0" : ""
        }`}
      >
        {top.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={top.posterUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </button>

      <div className="flex w-full flex-col items-center gap-[3px]">
        <span className="t-row text-[16px] font-semibold">{top.name}</span>
        {/* the deck endpoint carries no kind or runtime yet, so the line is the year alone */}
        <span className="t-meta">{top.year || ""}</span>
      </div>

      {/* the log field's four buckets, 1fr each across the 420px column */}
      <div className="flex w-full flex-col gap-[6px]">
        <div className="grid w-full grid-cols-4 gap-[8px]">
          {ACTIONS.map((a) => (
            <button key={a.action} type="button" onClick={() => act(a.action)} className="btn btn-fill px-0">
              {a.label}
            </button>
          ))}
        </div>
        <div className="grid w-full grid-cols-4 gap-[8px]">
          {ACTIONS.map((a) => (
            <span key={a.action} className="t-meta text-center">
              {a.key}
            </span>
          ))}
        </div>
      </div>

      <div className="flex w-full items-center gap-[16px]">
        <button type="button" onClick={undo} disabled={state.swipes.length === 0} className="t-link disabled:opacity-40">
          undo
        </button>
        <button type="button" onClick={skip} className="t-link">
          skip
        </button>
        {top.hint && <span className="t-meta ml-auto truncate">{top.hint}</span>}
      </div>
    </div>
  );
}
