"use client";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BrainStore } from "./canvas/brainStore";
import { ChatPanel } from "./chat/ChatPanel";
import { BrainPanel } from "./BrainPanel";
import { Sidebar } from "./Sidebar";
import { createThread, deleteThread, listThreads, useThreads } from "./chat/threads";
import type { RenderedBrain } from "@/lib/brain/render";
import type { EgoNetwork } from "@/lib/graph/ego";

export function HeadshotApp() {
  const store = useMemo(() => new BrainStore(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [selected, setSelected] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);
  const threads = useThreads();
  const [chosenThread, setChosenThread] = useState<string | null>(null);
  const threadId = chosenThread && threads.some((t) => t.id === chosenThread) ? chosenThread : (threads[0]?.id ?? null);
  const [brainFull, setBrainFull] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<"chat" | "brain">("chat");
  const [ego, setEgo] = useState<EgoNetwork | null>(null);
  const [egoImages, setEgoImages] = useState<Record<string, string | null>>({});

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
      setMobileView("brain");
      fetch(`/api/ego/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((e: EgoNetwork | null) => {
          if (!e) {
            store.setFocus([id]);
            return;
          }
          setEgo(e);
          // Faces for the center and first ring; the second ring stays as dots.
          const ids = e.nodes.filter((n) => n.ring <= 1).map((n) => n.imdbId).slice(0, 40);
          fetch(`/api/enrich?ids=${ids.join(",")}`)
            .then((r) => r.json())
            .then((d: { images: Record<string, { url: string | null }> }) =>
              setEgoImages((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(d.images).map(([k, v]) => [k, v.url])) })),
            )
            .catch(() => {});
        })
        .catch(() => store.setFocus([id]));
    },
    [store],
  );

  // "Show me X on the brain": the agent asked for an ego view (derived-state pattern, no effect).
  const egoReq = state.egoRequest;
  const [seenEgoReq, setSeenEgoReq] = useState<number | null>(null);
  if (egoReq && egoReq.nonce !== seenEgoReq) {
    setSeenEgoReq(egoReq.nonce);
    select(egoReq.imdbId);
  }

  // A new answer lighting a path takes over the panel: leave ego mode so the brain shows it.
  const litCount = state.highlight.altNodes.size;
  const [seenLit, setSeenLit] = useState(litCount);
  if (litCount !== seenLit) {
    setSeenLit(litCount);
    if (litCount > 0 && ego) setEgo(null);
  }

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
    setMobileView("chat");
    store.clearHighlight();
  };

  const stats = { nodes: state.nodeCount, edges: state.edgeCount, mine: state.sessionIds.size };
  const brain = (
    <BrainPanel
      store={store}
      state={state}
      selected={selected}
      onSelect={select}
      onDeselect={() => setSelected(null)}
      onExpand={expand}
      onAsk={(text) => {
        setPrefill({ text, nonce: Date.now() });
        setMobileView("chat");
        setBrainFull(false);
      }}
      onPick={(id) => (store.graph.hasNode(id) ? select(id) : expand(id))}
      full={brainFull}
      onToggleFull={() => setBrainFull((f) => !f)}
      ego={ego}
      egoImages={egoImages}
      onExitEgo={() => {
        setEgo(null);
        setSelected(null);
      }}
      onBackToChat={mobileView === "brain" ? () => setMobileView("chat") : undefined}
    />
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg">
      <div className={`hidden h-full md:block ${brainFull ? "md:hidden" : ""}`}>
        <Sidebar
          threads={threads}
          activeId={threadId}
          onSelect={(id) => setChosenThread(id)}
          onNew={newThread}
          onDelete={(id) => deleteThread(id)}
          stats={stats}
          onShowBrain={() => setBrainFull(true)}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />
      </div>

      {/* Chat column */}
      <main className={`relative h-full min-w-0 flex-1 ${brainFull ? "hidden" : ""} ${mobileView === "brain" ? "hidden md:block" : ""}`}>
        {/* Mobile header */}
        <div className="flex items-center justify-between border-b border-line px-3 py-2 md:hidden">
          <button onClick={newThread} className="text-[13px] text-ink-dim">+ New</button>
          <span className="text-[14px] font-semibold text-ink">Headshot</span>
          <button onClick={() => setMobileView("brain")} className="text-[13px] text-accent">
            Brain →
          </button>
        </div>
        {threadId && <ChatPanel key={threadId} threadId={threadId} store={store} prefill={prefill} onSelectNode={select} />}
      </main>

      {/* Brain column */}
      <div
        className={`h-full ${brainFull ? "w-full" : "w-full md:w-[46%] md:min-w-[440px] md:max-w-[880px] md:border-l md:border-line"} ${
          mobileView === "chat" && !brainFull ? "hidden md:block" : "block"
        }`}
      >
        {brain}
      </div>
    </div>
  );
}
