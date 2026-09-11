"use client";
import { BrainCanvas } from "./canvas/BrainCanvas";
import type { BrainStore, BrainState } from "./canvas/brainStore";
import { PagePanel } from "./page/PagePanel";
import { SearchBox } from "./SearchBox";

interface Props {
  store: BrainStore;
  state: BrainState;
  selected: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onExpand: (id: string) => void;
  onAsk: (text: string) => void;
  onPick: (id: string) => void;
  full: boolean;
  onToggleFull: () => void;
  /** Narrow-screen mode: show a back-to-chat button. */
  onBackToChat?: () => void;
}

export function BrainPanel({ store, state, selected, onSelect, onDeselect, onExpand, onAsk, onPick, full, onToggleFull, onBackToChat }: Props) {
  return (
    <section className="field relative h-full w-full overflow-hidden" aria-label="The brain">
      <BrainCanvas
        store={store}
        selected={selected}
        onClickNode={onSelect}
        onDoubleClickNode={onExpand}
        onClickEdge={(person, title) =>
          onAsk(`What did ${store.graph.getNodeAttribute(person, "label")} do on ${store.graph.getNodeAttribute(title, "label")}?`)
        }
        onClickStage={onDeselect}
      />

      {/* Toolbar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex items-center gap-2">
          {onBackToChat && (
            <button onClick={onBackToChat} className="panel px-3 py-1.5 text-[12.5px] text-ink hover:bg-white/5 md:hidden">
              ← Chat
            </button>
          )}
          <SearchBox onPick={onPick} />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button onClick={onToggleFull} className="panel px-3 py-1.5 text-[12.5px] text-ink-dim hover:text-ink" title={full ? "Back to split view" : "Full screen"}>
            {full ? "Split" : "Focus"}
          </button>
        </div>
      </div>

      {/* Stats + status */}
      <div className="pointer-events-none absolute bottom-3 left-3 space-y-0.5 font-mono text-[11px] text-ink-faint">
        <div>
          {state.nodeCount} nodes · {state.edgeCount} edges
          {state.sessionIds.size > 0 && <span className="text-session"> · {state.sessionIds.size} yours</span>}
        </div>
        {state.status && <div className="text-accent">{state.status}</div>}
        {!state.loaded && <div>loading the brain…</div>}
        {state.loaded && state.nodeCount === 0 && <div>the brain is empty. ask it something.</div>}
      </div>

      {/* Page drawer */}
      {selected && (
        <div className="pointer-events-none absolute bottom-3 right-3 top-14">
          <PagePanel key={selected} imdbId={selected} onClose={onDeselect} onSelectNode={onSelect} onAsk={onAsk} onExpand={onExpand} />
        </div>
      )}
    </section>
  );
}
