"use client";
/**
 * The swipe deck, drawn against DESIGN.md § Swipe deck.
 *
 * Posters are the only colour in board C, so here the poster *is* the screen:
 * 260×390, no radius, no shadow, no card behind it. Everything around it stays
 * at the board's scale — the title as `.t-row` at 16/600 over one mono facts
 * line, the log field's four bucket buttons at 44px across a 420px row with
 * mono `1 2 3 4` under them, the progress as a mono figure top-right, `undo`
 * and `skip` as `.t-link`s bottom-left. A card leaving is a 300ms translate and
 * fade with a 2° rotation: no colour overlay, no stamp.
 *
 * On a phone the poster keeps its 2:3 and shrinks to the column, so nothing
 * scrolls sideways (DESIGN.md → Rhythm → Phone).
 *
 * State is the pure reducer in `src/lib/picks/swipe`; the end rules are the
 * pure module in `src/components/you/swipeRules`. This component never
 * writes: `onCommit` hands the rows up and the session route persists them.
 * Keyboard: 1-4 to rate, z to undo, s to skip.
 */
import { useEffect, useReducer, useRef, useState } from "react";
import { committedRows, initialSwipeState, swipeReducer, type SwipeAction } from "@/lib/picks/swipe";
import { deckCardMeta, finishLabel, progressLabel, canFinish } from "@/components/you/swipeRules";

export interface DeckCard {
  imdbId: string;
  name: string;
  year: number;
  posterUrl: string | null;
  /** `film` or `show` from the deck route; `titleType` is the pre-v4 spelling. */
  kind?: string | null;
  titleType?: string | null;
  runtime?: number | null;
  /** Why it is in the deck, one line. */
  hint?: string;
}

interface Props {
  cards: DeckCard[];
  /** The committed rows after every change; the caller decides when to persist. */
  onCommit?: (rows: CommittedRow[]) => void;
  onSelectNode?: (imdbId: string) => void;
  /**
   * End of session: the deck ran out, or the user said "done for now". The
   * rows are handed over again so the caller never has to remember them.
   */
  onFinish?: (rows: CommittedRow[]) => void;
}

/**
 * The four buttons, in the log field's order and words.
 *
 * TODO(v5-B): the deck's card becomes "seen it" → a row of ten (SPEC v5). Until
 * then the four words stand and each one carries the score it used to mean.
 */
const ACTIONS: { id: string; action: SwipeAction; label: string; key: string }[] = [
  { id: "liked", action: { rating: "rated", score: 8 }, label: "liked", key: "1" },
  { id: "meh", action: { rating: "rated", score: 5 }, label: "meh", key: "2" },
  { id: "want", action: { rating: "want" }, label: "want", key: "3" },
  { id: "unseen", action: { rating: "unseen" }, label: "seen", key: "4" },
];

/** A committed row as the swipe routes take it. */
type CommittedRow = ReturnType<typeof committedRows>[number];

export function SwipeDeck({ cards, onCommit, onSelectNode, onFinish }: Props) {
  const [state, dispatch] = useReducer(swipeReducer, cards.map((c) => c.imdbId), initialSwipeState);
  /**
   * The card in flight, with the choice that sent it. It keeps the *outgoing*
   * card on screen for its 300ms so the animation reads as that card leaving —
   * render the new one with the flight class and it is the arriving card that
   * flies out, which is the wrong story.
   */
  const [leaving, setLeaving] = useState<{ action: SwipeAction; card: DeckCard } | null>(null);
  const byId = new Map(cards.map((c) => [c.imdbId, c]));
  const top = state.remaining[0] ? byId.get(state.remaining[0]) : undefined;
  const rated = state.swipes.length;

  // The deck ends itself exactly once: a re-render must not re-post a session.
  const finished = useRef(false);
  const finish = (rows: CommittedRow[]) => {
    if (finished.current) return;
    finished.current = true;
    onFinish?.(rows);
  };

  const act = (action: SwipeAction) => {
    if (!top) return;
    setLeaving({ action, card: top });
    const next = swipeReducer(state, { type: "swipe", action });
    dispatch({ type: "swipe", action });
    onCommit?.(committedRows(next));
    setTimeout(() => setLeaving(null), 300);
    if (next.remaining.length === 0) finish(committedRows(next));
  };
  const undo = () => {
    const next = swipeReducer(state, { type: "undo" });
    dispatch({ type: "undo" });
    onCommit?.(committedRows(next));
  };
  const skip = () => dispatch({ type: "skip" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const a = ACTIONS.find((x) => x.key === e.key);
      if (a) act(a.action);
      else if (e.key === "z") undo();
      else if (e.key === "s") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // A deck that has run out ends the session rather than sitting on a dead
  // screen; the waiting state belongs to the caller. `act` normally gets there
  // first — this is the belt for a reset or a re-deal.
  const spent = !top && cards.length > 0;
  useEffect(() => {
    if (spent) finish(committedRows(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spent]);

  if (!top) return <p className="t-meta">that&apos;s the deck.</p>;

  const ready = canFinish(rated);
  // What is drawn: the card leaving, until it has left. The next one then
  // simply appears — nothing animates in (DESIGN.md → Motion).
  const shown = leaving?.card ?? top;
  const flight = !leaving
    ? ""
    : (leaving.action.score ?? 0) >= 7 || leaving.action.rating === "want"
      ? "translate-x-12 rotate-2 opacity-0"
      : "-translate-x-12 -rotate-2 opacity-0";

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-[18px]" aria-label="Swipe deck">
      {/* the progress, as a mono figure */}
      <div className="flex w-full items-baseline">
        <span className="t-meta ml-auto tnum">{progressLabel(rated, cards.length)}</span>
      </div>

      {/* the poster is the screen, and the card leaves as one thing. The title
          sits 14px under it and the controls 26px under that, so the identity
          block reads as one thing and the buckets as another. */}
      <div className={`flex w-full flex-col items-center gap-[14px] transition duration-300 ease-out ${flight}`}>
        <button
          type="button"
          onClick={() => onSelectNode?.(shown.imdbId)}
          title={shown.hint ?? shown.name}
          className="block aspect-[2/3] w-[260px] max-w-full shrink-0 cursor-pointer overflow-hidden bg-raised"
        >
          {shown.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown.posterUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </button>

        <div className="flex w-full flex-col items-center gap-[3px]">
          <span className="t-row text-center text-[16px] font-semibold">{shown.name}</span>
          <span className="t-meta">{deckCardMeta(shown)}</span>
        </div>
      </div>

      {/* the log field's four buckets, 1fr each across the 420px column */}
      <div className="mt-[8px] flex w-full flex-col gap-[6px]">
        <div className="grid w-full grid-cols-4 gap-[8px]">
          {ACTIONS.map((a) => (
            <button key={a.id} type="button" onClick={() => act(a.action)} className="btn btn-fill px-0">
              {a.label}
            </button>
          ))}
        </div>
        {/* the keyboard hints, hidden where there is no keyboard — the same
            rule the log field's `1 2 3 4` follows (Prompt.tsx). */}
        <div className="hidden w-full grid-cols-4 gap-[8px] sm:grid">
          {ACTIONS.map((a) => (
            <span key={a.id} className="t-meta text-center">
              {a.key}
            </span>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center gap-x-[16px] gap-y-[8px]">
        <button type="button" onClick={undo} disabled={rated === 0} className="t-link disabled:opacity-40">
          undo
        </button>
        <button type="button" onClick={skip} className="t-link">
          skip
        </button>
        {/* "done for now" unlocks at ten; before that the same slot says the cost. */}
        {ready ? (
          <button type="button" onClick={() => finish(committedRows(state))} className="t-link ml-auto">
            {finishLabel(rated)}
          </button>
        ) : (
          <span className="t-meta ml-auto">{finishLabel(rated)}</span>
        )}
      </div>
    </div>
  );
}
