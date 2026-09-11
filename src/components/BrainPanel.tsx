"use client";
import { BrainCanvas } from "./canvas/BrainCanvas";
import type { BrainStore, BrainState } from "./canvas/brainStore";
import { PagePanel } from "./page/PagePanel";
import { SearchBox } from "./SearchBox";
import type { EgoNetwork } from "@/lib/graph/ego";

interface Props {
  store: BrainStore;
  state: BrainState;
  selected: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onExpand: (id: string) => void;
  onAsk: (text: string) => void;
  onPick: (id: string) => void;
  ego: EgoNetwork | null;
  egoImages: Record<string, string | null>;
  onExitEgo: () => void;
  /** Dismiss the panel. */
  onClose: () => void;
  /** Set while the ego view is the user's own taste map. */
  taste?: { facts: { people: { name: string; count: number }[]; avgRuntimeFinished: number | null; tvShare: number | null; eras: Record<string, number> }; rated: number; later: number } | null;
}

export function BrainPanel({ store, state, selected, onSelect, onDeselect, onExpand, onAsk, onPick, ego, egoImages, onExitEgo, onClose, taste }: Props) {
  const centerName = taste ? "your taste" : ego ? ego.nodes.find((n) => n.ring === 0)?.name : null;
  const topDecade = taste ? Object.entries(taste.facts.eras).sort((a, b) => b[1] - a[1])[0]?.[0] : null;
  return (
    <section className="field relative h-full w-full overflow-hidden" aria-label="The brain">
      <BrainCanvas
        store={store}
        selected={selected}
        ego={ego}
        egoImages={egoImages}
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
          <SearchBox onPick={onPick} />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {ego && (
            <button onClick={onExitEgo} className="panel flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-ink hover:bg-white/5" title="Back to the whole brain">
              <span className="text-accent">●</span> {centerName}
              <span className="text-ink-faint">· whole brain</span>
            </button>
          )}
          <button onClick={onClose} className="panel flex size-8 items-center justify-center text-ink-dim hover:text-ink" title="Close" aria-label="Close panel">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 5l10 10M15 5 5 15" /></svg>
          </button>
        </div>
      </div>

      {/* Stats + status */}
      <div className="pointer-events-none absolute bottom-3 left-3 space-y-0.5 font-mono text-[11px] text-ink-faint">
        {ego && taste ? (
          <div className="space-y-0.5">
            <div>
              <span className="text-accent">●</span> liked &nbsp;<span className="text-ink-dim">●</span> meh &nbsp;<span className="text-title">●</span> title
            </div>
            <div>
              {taste.rated} rated · {taste.later} later
              {taste.facts.avgRuntimeFinished ? ` · finishes ~${taste.facts.avgRuntimeFinished} min` : ""}
              {taste.facts.tvShare !== null ? ` · tv ${Math.round(taste.facts.tvShare * 100)}%` : ""}
              {topDecade ? ` · strongest ${topDecade}` : ""}
            </div>
            {taste.facts.people.length > 0 && <div>you keep watching {taste.facts.people.slice(0, 3).map((p) => `${p.name} (${p.count})`).join(", ")}</div>}
          </div>
        ) : ego ? (
          <div>
            {centerName}: {ego.nodes.filter((n) => n.ring === 1).length} direct · {ego.nodes.filter((n) => n.ring === 2).length} once removed · click a node to re-center
          </div>
        ) : (
          <div>
            {state.nodeCount} nodes · {state.edgeCount} edges
            {state.sessionIds.size > 0 && <span className="text-session"> · {state.sessionIds.size} yours</span>}
          </div>
        )}
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
