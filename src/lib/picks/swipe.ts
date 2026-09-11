/**
 * The swipe deck as a pure reducer (v3): four actions on the top card, undo
 * always. The client renders from this state and posts committed swipes to
 * the taste store; nothing the user did not tap changes taste.
 */
import type { Bucket } from "./engine";

export type SwipeAction = Bucket; // liked | meh | unseen | want

export interface Swipe {
  imdbId: string;
  action: SwipeAction;
  at: number;
}

export interface SwipeState {
  /** Cards still to show, top first. */
  remaining: string[];
  /** Committed swipes in order. */
  swipes: Swipe[];
  /** Swipes that were undone and may be redone. */
  undone: Swipe[];
}

export type SwipeEvent = { type: "swipe"; action: SwipeAction; at?: number } | { type: "undo" } | { type: "redo" } | { type: "skip" } | { type: "reset"; deck: string[] };

export function initialSwipeState(deck: string[]): SwipeState {
  return { remaining: [...deck], swipes: [], undone: [] };
}

export function swipeReducer(state: SwipeState, event: SwipeEvent): SwipeState {
  switch (event.type) {
    case "reset":
      return initialSwipeState(event.deck);
    case "swipe": {
      const [top, ...rest] = state.remaining;
      if (!top) return state;
      return { remaining: rest, swipes: [...state.swipes, { imdbId: top, action: event.action, at: event.at ?? Date.now() }], undone: [] };
    }
    case "skip": {
      // Move the top card to the back; not a signal, nothing recorded.
      const [top, ...rest] = state.remaining;
      if (!top) return state;
      return { ...state, remaining: [...rest, top] };
    }
    case "undo": {
      const last = state.swipes[state.swipes.length - 1];
      if (!last) return state;
      return { remaining: [last.imdbId, ...state.remaining], swipes: state.swipes.slice(0, -1), undone: [...state.undone, last] };
    }
    case "redo": {
      const next = state.undone[state.undone.length - 1];
      if (!next || state.remaining[0] !== next.imdbId) return state;
      return { remaining: state.remaining.slice(1), swipes: [...state.swipes, next], undone: state.undone.slice(0, -1) };
    }
  }
}

/** The rows to persist: one per title, last action wins (an undo removes it). */
export function committedRows(state: SwipeState): { imdbId: string; rating: Bucket }[] {
  const by = new Map<string, Bucket>();
  for (const s of state.swipes) by.set(s.imdbId, s.action);
  return [...by].map(([imdbId, rating]) => ({ imdbId, rating }));
}
