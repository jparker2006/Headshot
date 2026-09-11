"use client";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BrainCanvas } from "./canvas/BrainCanvas";
import { BrainStore } from "./canvas/brainStore";
import { ChatPanel } from "./chat/ChatPanel";
import { PagePanel } from "./page/PagePanel";
import { SearchBox } from "./SearchBox";
import { createThread, deleteThread, listThreads, useThreads } from "./chat/threads";
import type { RenderedBrain } from "@/lib/brain/render";

export function HeadshotApp() {
  const store = useMemo(() => new BrainStore(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [selected, setSelected] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);
  const threads = useThreads();
  const [chosenThread, setChosenThread] = useState<string | null>(null);
  const threadId = chosenThread && threads.some((t) => t.id === chosenThread) ? chosenThread : (threads[0]?.id ?? null);
  const [threadsOpen, setThreadsOpen] = useState(false);

  const refreshBrain = useCallback(async () => {
    const r = await fetch("/api/brain", { cache: "no-store" });
    if (r.ok) store.load((await r.json()) as RenderedBrain);
  }, [store]);

  useEffect(() => {
    void refreshBrain();
  }, [refreshBrain]);

  // Guarantee one thread exists. Reads localStorage directly (client-only in effects)
  // rather than the rendered list, which is still the server snapshot during hydration.
  useEffect(() => {
    if (listThreads().length === 0) createThread();
  }, [threads]);

  const select = useCallback(
    (id: string) => {
      setSelected(id);
      store.setFocus([id]);
    },
    [store],
  );

  const expand = useCallback(
    async (imdbId: string) => {
      store.setStatus("Expanding…");
      const r = await fetch("/api/expand", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ imdbId }) });
      if (r.ok) await refreshBrain();
      store.setStatus(r.ok ? null : "Could not expand");
      select(imdbId);
    },
    [refreshBrain, select, store],
  );

  const newThread = () => {
    const t = createThread();
    setChosenThread(t.id);
    setThreadsOpen(false);
    store.clearHighlight();
  };

  return (
    <div className="field relative h-full w-full overflow-hidden">
      <BrainCanvas
        store={store}
        selected={selected}
        onClickNode={select}
        onDoubleClickNode={expand}
        onClickEdge={(person, title) => setPrefill({ text: `What did ${store.graph.getNodeAttribute(person, "label")} do on ${store.graph.getNodeAttribute(title, "label")}?`, nonce: Date.now() })}
        onClickStage={() => setSelected(null)}
      />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <div className="pointer-events-auto min-w-0">
          <h1 className="text-[18px] font-semibold tracking-tight text-ink">Headshot</h1>
          <p className="text-[12px] text-ink-dim">The shared brain of who was in what with whom.</p>
          <div className="mt-2 space-y-0.5 font-mono text-[11px] text-ink-faint">
            <div>
              {state.nodeCount} nodes · {state.edgeCount} edges
              {state.sessionIds.size > 0 && <span className="text-session"> · {state.sessionIds.size} yours</span>}
            </div>
            {state.status && <div className="text-accent">{state.status}</div>}
            {!state.loaded && <div>loading the brain…</div>}
            {state.loaded && state.nodeCount === 0 && <div>the brain is empty. ask it something.</div>}
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          <SearchBox onPick={(id) => (store.graph.hasNode(id) ? select(id) : expand(id))} />
          <div className="relative">
            <button onClick={() => setThreadsOpen((o) => !o)} className="rounded-lg px-3 py-2 text-[13px] text-ink-dim ring-1 ring-line hover:text-ink">
              Threads
            </button>
            {threadsOpen && (
              <div className="panel absolute right-0 top-full z-20 mt-1 w-72 py-1">
                <button onClick={newThread} className="w-full px-3 py-2 text-left text-[13px] text-accent hover:bg-white/5">+ New thread</button>
                {threads.map((t) => (
                  <div key={t.id} className={`flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-white/5 ${t.id === threadId ? "text-ink" : "text-ink-dim"}`}>
                    <button onClick={() => { setChosenThread(t.id); setThreadsOpen(false); }} className="min-w-0 flex-1 truncate text-left">{t.title}</button>
                    <button
                      onClick={() => deleteThread(t.id)}
                      className="text-[11px] text-ink-faint hover:text-danger"
                      aria-label="Delete thread"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Page panel */}
      {selected && (
        <div className="pointer-events-none absolute bottom-4 right-4 top-16">
          <PagePanel
            key={selected}
            imdbId={selected}
            onClose={() => setSelected(null)}
            onSelectNode={select}
            onAsk={(text) => setPrefill({ text, nonce: Date.now() })}
            onExpand={expand}
          />
        </div>
      )}

      {/* Chat: docked bottom-left so the path stays visible in the middle of the field */}
      <div className="pointer-events-none absolute bottom-4 left-4">
        {threadId && <ChatPanel key={threadId} threadId={threadId} store={store} prefill={prefill} onSelectNode={select} />}
      </div>
    </div>
  );
}
