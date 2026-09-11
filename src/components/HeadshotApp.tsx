"use client";
/**
 * The shell (v3 UI): a 56px rail, one reading column, and a panel on the
 * right that only appears when summoned. The panel hosts the brain canvas
 * (whole brain, an ego view, or your taste map) with the title drawer inside
 * it. Nothing about the graph is on screen until you ask for it; on a phone
 * the panel is a full-screen sheet.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BrainStore } from "./canvas/brainStore";
import { ChatPanel } from "./chat/ChatPanel";
import { BrainPanel } from "./BrainPanel";
import { Rail, type Surface } from "./Rail";
import { createThread, deleteThread, listThreads, useThreads } from "./chat/threads";
import type { RenderedBrain } from "@/lib/brain/render";
import type { EgoNetwork } from "@/lib/graph/ego";

type TasteMeta = { facts: { people: { name: string; count: number }[]; avgRuntimeFinished: number | null; tvShare: number | null; eras: Record<string, number> }; rated: number; later: number };

export function HeadshotApp() {
  const store = useMemo(() => new BrainStore(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [selected, setSelected] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);
  const threads = useThreads();
  const [chosenThread, setChosenThread] = useState<string | null>(null);
  const threadId = chosenThread && threads.some((t) => t.id === chosenThread) ? chosenThread : (threads[0]?.id ?? null);
  const [panel, setPanel] = useState(false);
  const [ego, setEgo] = useState<EgoNetwork | null>(null);
  const [egoImages, setEgoImages] = useState<Record<string, string | null>>({});
  const [taste, setTaste] = useState<TasteMeta | null>(null);

  const refreshBrain = useCallback(async () => {
    const r = await fetch("/api/brain", { cache: "no-store" });
    if (r.ok) store.load((await r.json()) as RenderedBrain);
  }, [store]);

  useEffect(() => {
    void refreshBrain();
  }, [refreshBrain]);

  // Deep links: /?q=<question> prefills the composer, /?open=<imdbId> opens the drawer.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const open = params.get("open");
    if (!q && !open) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (q) store.requestPrefill(q);
    if (open && /^(nm|tt)\d+$/.test(open)) store.requestEgo(open);
  }, [store]);

  useEffect(() => {
    if (listThreads().length === 0) createThread();
  }, [threads]);

  const loadFaces = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    fetch(`/api/enrich?ids=${ids.slice(0, 40).join(",")}`)
      .then((r) => r.json())
      .then((d: { images: Record<string, { url: string | null }> }) => setEgoImages((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(d.images).map(([k, v]) => [k, v.url])) })))
      .catch(() => {});
  }, []);

  /** Open a person or title: its ego view in the panel with the drawer on it. `reveal` shows the panel. */
  const select = useCallback(
    (id: string, reveal = true) => {
      if (id === "me") return;
      setSelected(id);
      setTaste(null);
      if (reveal) setPanel(true);
      fetch(`/api/ego/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((e: EgoNetwork | null) => {
          if (!e) {
            store.setFocus([id]);
            return;
          }
          setEgo(e);
          loadFaces(e.nodes.filter((n) => n.ring <= 1).map((n) => n.imdbId));
        })
        .catch(() => store.setFocus([id]));
    },
    [store, loadFaces],
  );

  const showTasteMap = useCallback(async () => {
    setPanel(true);
    setSelected(null);
    const r = await fetch("/api/taste/map", { cache: "no-store" });
    if (r.status === 401) {
      window.location.assign("/auth/sign-in?next=/");
      return;
    }
    if (!r.ok) {
      store.setStatus("Could not load your taste map");
      return;
    }
    const d = (await r.json()) as { network: EgoNetwork; facts: TasteMeta["facts"]; rated: number; later: number };
    if (d.network.nodes.length <= 1) {
      store.setStatus("Rate a few things first and your map appears here");
      return;
    }
    setEgo(d.network);
    setTaste({ facts: d.facts, rated: d.rated, later: d.later });
    loadFaces(d.network.nodes.filter((n) => n.ring === 1 && n.imdbId !== "me").map((n) => n.imdbId));
  }, [store, loadFaces]);

  const showBrain = useCallback(() => {
    setEgo(null);
    setTaste(null);
    setSelected(null);
    setPanel(true);
  }, []);

  // "Show me X on the brain" and the ego-by-default after an answer (derived state, no effects).
  const egoReq = state.egoRequest;
  const [seenEgoReq, setSeenEgoReq] = useState<number | null>(null);
  if (egoReq && egoReq.nonce !== seenEgoReq) {
    setSeenEgoReq(egoReq.nonce);
    select(egoReq.imdbId, egoReq.reveal);
  }

  const prefillReq = state.prefillRequest;
  const [seenPrefillReq, setSeenPrefillReq] = useState<number | null>(null);
  if (prefillReq && prefillReq.nonce !== seenPrefillReq) {
    setSeenPrefillReq(prefillReq.nonce);
    setPrefill({ text: prefillReq.text, nonce: prefillReq.nonce });
  }

  // A newly lit path belongs to the whole brain, not an ego view.
  const litCount = state.highlight.altNodes.size;
  const [seenLit, setSeenLit] = useState(litCount);
  if (litCount !== seenLit) {
    setSeenLit(litCount);
    if (litCount > 0 && ego) {
      setEgo(null);
      setTaste(null);
    }
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
    setPanel(false);
    store.clearHighlight();
  };

  const closePanel = () => {
    setPanel(false);
    setSelected(null);
  };

  const surface: Surface = panel ? (taste ? "map" : "brain") : "tonight";

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg">
      <div className="hidden h-full md:block">
        <Rail
          surface={surface}
          threads={threads}
          activeId={threadId}
          onHome={newThread}
          onNew={newThread}
          onSelectThread={(id) => {
            setChosenThread(id);
            setPanel(false);
          }}
          onDeleteThread={(id) => deleteThread(id)}
          onMap={() => void showTasteMap()}
          onBrain={showBrain}
        />
      </div>

      {/* The reading column */}
      <main className="relative h-full min-w-0 flex-1">
        <div className="flex items-center justify-between border-b border-line px-3 py-2 md:hidden">
          <button onClick={newThread} className="text-[13px] text-ink-dim">
            + New
          </button>
          <span className="text-[14px] font-semibold text-ink">Headshot</span>
          <button onClick={showBrain} className="text-[13px] text-ink-dim">
            Brain
          </button>
        </div>
        {threadId && <ChatPanel key={threadId} threadId={threadId} store={store} prefill={prefill} onSelectNode={select} />}
      </main>

      {/* The panel: summoned, never resident */}
      <div
        className={`sheet fixed inset-0 z-40 md:static md:inset-auto md:z-auto md:h-full md:shrink-0 md:border-l md:border-line ${panel ? "md:w-[440px] lg:w-[480px]" : "hidden md:block md:w-0 md:border-l-0"}`}
        aria-hidden={!panel}
      >
        {panel && (
          <BrainPanel
            store={store}
            state={state}
            selected={selected}
            onSelect={select}
            onDeselect={() => setSelected(null)}
            onExpand={expand}
            onAsk={(text) => {
              setPrefill({ text, nonce: Date.now() });
              setPanel(false);
            }}
            onPick={(id) => (store.graph.hasNode(id) ? select(id) : expand(id))}
            ego={ego}
            egoImages={egoImages}
            taste={taste}
            onExitEgo={() => {
              setEgo(null);
              setTaste(null);
              setSelected(null);
            }}
            onClose={closePanel}
          />
        )}
      </div>
    </div>
  );
}
