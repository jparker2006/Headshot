"use client";
/**
 * The catch-up deck's cards, drawn against DESIGN.md § Swipe deck with v5's
 * two-step control in place of the four bucket words.
 *
 * Posters are the only colour in board C, so here the poster *is* the screen:
 * 260×390, no radius, no shadow, no card behind it. Everything around it stays
 * at the board's scale — the title as `.t-row` at 16/600 over one mono facts
 * line, the progress as a mono figure top-right, `undo` and `done for now` as
 * `.t-link`s at the bottom. A card leaving is a 300ms translate and fade with
 * a 2° rotation: no colour overlay, no stamp.
 *
 * The control is two steps, because a catch-up card only ever asks one
 * question first: `seen it` / `not seen` as two `.btn-fill`s (keys `s` / `n`).
 * `not seen` commits `unseen` and advances; `seen it` reveals the row of ten
 * (`ScoreRow`, the same component the Log page and the drawer use) and a digit
 * commits the score and advances. `undo` (`z`) takes back the most recent
 * thing you did — the reveal first, then the card before it.
 *
 * On a phone the poster keeps its 2:3 and shrinks to the column, so nothing
 * scrolls sideways (DESIGN.md → Rhythm → Phone).
 *
 * State is the pure reducer in `src/lib/picks/swipe`; the words and the keys
 * are the pure module in `src/components/you/swipeRules`. This component never
 * writes: `onFinish` hands the rows up and the session route persists them.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ScoreRow } from "@/components/log/ScoreRow";
import { committedRows, initialSwipeState, swipeReducer, type SwipeAction } from "@/lib/picks/swipe";
import { UNDO_KEY, UNSEEN_ACTION, VERDICTS, deckCardMeta, doneLabel, progressLabel, scoreAction } from "@/components/you/swipeRules";

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
   * End of round: the ten ran out, or the user said "done for now". The rows
   * are handed over again so the caller never has to remember them.
   */
  onFinish?: (rows: CommittedRow[]) => void;
}

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
  /** Step two is revealed for the card you said you had seen, and only that card. */
  const [revealed, setRevealed] = useState(false);
  const byId = new Map(cards.map((c) => [c.imdbId, c]));
  const top = state.remaining[0] ? byId.get(state.remaining[0]) : undefined;
  const rated = state.swipes.length;

  // The round ends itself exactly once: a re-render must not re-post a session.
  const finished = useRef(false);
  const finish = (rows: CommittedRow[]) => {
    if (finished.current) return;
    finished.current = true;
    onFinish?.(rows);
  };

  const act = useCallback(
    (action: SwipeAction) => {
      if (!top) return;
      setLeaving({ action, card: top });
      setRevealed(false);
      const next = swipeReducer(state, { type: "swipe", action });
      dispatch({ type: "swipe", action });
      onCommit?.(committedRows(next));
      setTimeout(() => setLeaving(null), 300);
      if (next.remaining.length === 0) finish(committedRows(next));
    },
    // `finish` and `dispatch` are stable enough for the one frame this lives in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [top, state, onCommit],
  );

  /**
   * One step back, whichever step you are on: the reveal is the most recent
   * thing you did, so it goes first, and the press after that takes the card
   * before it back (un-revealed, at step one).
   */
  const undo = useCallback(() => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    const next = swipeReducer(state, { type: "undo" });
    dispatch({ type: "undo" });
    onCommit?.(committedRows(next));
  }, [revealed, state, onCommit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === UNDO_KEY) {
        undo();
        return;
      }
      // Step one only: once the row of ten is up, the digits are its keys and
      // `s` / `n` would answer a question that has already been answered.
      if (revealed) return;
      if (e.key === VERDICTS[0].key) setRevealed(true);
      else if (e.key === VERDICTS[1].key) act(UNSEEN_ACTION);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, undo, revealed]);

  // A deck that has run out ends the round rather than sitting on a dead
  // screen; the waiting state belongs to the caller. `act` normally gets there
  // first — this is the belt for a reset or a re-deal.
  const spent = !top && cards.length > 0;
  useEffect(() => {
    if (spent) finish(committedRows(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spent]);

  if (!top) return <p className="t-meta">that&apos;s the deck.</p>;

  // What is drawn: the card leaving, until it has left. The next one then
  // simply appears — nothing animates in (DESIGN.md → Motion).
  const shown = leaving?.card ?? top;
  const flight = !leaving ? "" : leaving.action.rating === "rated" ? "translate-x-12 rotate-2 opacity-0" : "-translate-x-12 -rotate-2 opacity-0";

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-[18px]" aria-label="Catch-up deck">
      {/* the progress, as a mono figure */}
      <div className="flex w-full items-baseline">
        <span className="t-meta ml-auto tnum">{progressLabel(rated, cards.length)}</span>
      </div>

      {/* the poster is the screen, and the card leaves as one thing. The title
          sits 14px under it and the controls 26px under that, so the identity
          block reads as one thing and the answer as another. */}
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

      {/* step one: the only question a catch-up card asks. Step two replaces
          it in the same place, so the control never grows a second row of
          buttons the eye has to choose between. */}
      {!revealed ? (
        <div className="mt-[8px] flex w-full flex-col gap-[6px]">
          <div className="grid w-full grid-cols-2 gap-[8px]">
            <button type="button" onClick={() => setRevealed(true)} className="btn btn-fill px-0">
              {VERDICTS[0].label}
            </button>
            <button type="button" onClick={() => act(UNSEEN_ACTION)} className="btn btn-fill px-0">
              {VERDICTS[1].label}
            </button>
          </div>
          {/* the keyboard hints, hidden where there is no keyboard — the same
              rule the log field follows (Prompt.tsx). */}
          <div className="hidden w-full grid-cols-2 gap-[8px] sm:grid">
            {VERDICTS.map((v) => (
              <span key={v.id} className="t-meta text-center">
                {v.key}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* ten 44px cells are 494px wide and the card column is 420, so the
           row is held to five-and-five here — the break the phone board draws
           (design/boards-v5/Log-phone.dc.html), centred under the poster. */
        <div className="mt-[8px] flex w-full justify-center">
          <div className="w-[244px] max-w-full">
            <ScoreRow value={null} size="md" keyboard onChange={(score) => act(scoreAction(score))} />
          </div>
        </div>
      )}

      <div className="flex w-full flex-wrap items-center gap-x-[16px] gap-y-[8px]">
        <button type="button" onClick={undo} disabled={rated === 0 && !revealed} className="t-link disabled:opacity-40">
          undo
        </button>
        {/* no floor: a round is these ten, or whatever you got through. */}
        <button type="button" onClick={() => finish(committedRows(state))} className="t-link ml-auto">
          {doneLabel()}
        </button>
      </div>
    </div>
  );
}
