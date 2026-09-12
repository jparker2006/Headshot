"use client";
/**
 * What the shell keeps while the agent is talking: the status line, and the
 * two things a turn can ask the shell to do — open a title in the drawer
 * (`focus-ego`, `/?open=`) and put a question in the composer (`/?q=`).
 *
 * It used to be a graphology graph behind a sigma canvas. v5 has no canvas
 * (SPEC v5 → Delete list), so the graph, the layout, the node and edge attrs
 * and the highlight sets went with it; every data part the agent streams is
 * still accepted here, because the transport still sends them and dropping one
 * on the floor silently would be worse than reading it and saying nothing.
 *
 * Consumed through `useSyncExternalStore`.
 */
import type { HeadshotDataParts } from "@/lib/agent/events";

export interface BrainState {
  version: number;
  /** The one line the shell shows while a turn runs. */
  status: string | null;
  /** "Show me X": the shell opens this node's drawer. Nonce so repeats fire. */
  egoRequest: { imdbId: string; nonce: number; reveal: boolean } | null;
  /** A question another surface wants placed in the composer (deep link /?q=). */
  prefillRequest: { text: string; nonce: number } | null;
}

export class BrainStore {
  private listeners = new Set<() => void>();
  private state: BrainState = { version: 0, status: null, egoRequest: null, prefillRequest: null };

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.state;

  private bump(patch: Partial<BrainState> = {}) {
    this.state = { ...this.state, ...patch, version: this.state.version + 1 };
    for (const fn of this.listeners) fn();
  }

  /**
   * One streamed data part. Only the parts that say something a person can
   * read move anything; the rest are accepted and ignored on purpose.
   */
  apply<K extends keyof HeadshotDataParts>(type: K, data: HeadshotDataParts[K]) {
    switch (type) {
      case "candidates": {
        const d = data as HeadshotDataParts["candidates"];
        this.bump({ status: `Resolving "${d.query}"` });
        return;
      }
      case "paths": {
        const d = data as HeadshotDataParts["paths"];
        this.bump({
          status:
            d.baconNumber === null
              ? "No connection found"
              : `${d.full?.paths.length ?? 0} tied routes, ${d.baconNumber} ${d.baconNumber === 1 ? "degree" : "degrees"} apart`,
        });
        return;
      }
      case "status": {
        this.bump({ status: (data as HeadshotDataParts["status"]).text });
        return;
      }
      case "page": {
        this.bump({ status: "Wrote a page" });
        return;
      }
      case "focus-ego": {
        const d = data as HeadshotDataParts["focus-ego"];
        this.requestEgo(d.imdbId);
        this.bump({ status: `Showing ${d.name}` });
        return;
      }
      case "fast": {
        const d = data as HeadshotDataParts["fast"];
        this.bump({ status: d.cached ? "Remembered this one" : "Computed before asking the model" });
        return;
      }
      default:
        return;
    }
  }

  /** Ask the shell to open a node's drawer. `reveal` brings it forward on a phone. */
  requestEgo(imdbId: string, opts: { reveal?: boolean } = {}) {
    this.bump({ egoRequest: { imdbId, nonce: Date.now() + Math.random(), reveal: opts.reveal ?? true } });
  }

  /** Ask the shell to put a question in the composer. */
  requestPrefill(text: string) {
    this.bump({ prefillRequest: { text, nonce: Date.now() + Math.random() } });
  }

  /** Leaving a surface clears whatever the last turn was saying. */
  clearHighlight() {
    this.bump({ status: null });
  }

  setStatus(status: string | null) {
    this.bump({ status });
  }
}
