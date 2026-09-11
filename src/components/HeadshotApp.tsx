"use client";
/**
 * The shell: a collapsible ChatGPT-shaped sidebar, one reading column, and a
 * title drawer that slides in from the right when a name or poster is tapped.
 * Surfaces in the column: You (home, SPEC v4), a thread, Later, and Your
 * taste. The graph canvas is not part of the product surface; /brain keeps it
 * for the curious.
 *
 * One way in: the You page carries a composer, and anything typed there (or
 * asked from the drawer, or arriving on /?q=) opens a thread with the question
 * already sent.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BrainStore } from "./canvas/brainStore";
import { ChatPanel } from "./chat/ChatPanel";
import { PagePanel } from "./page/PagePanel";
import { Sidebar, type Surface } from "./Sidebar";
import { LaterPanel } from "./tonight/LaterPanel";
import { TastePanel } from "./tonight/TastePanel";
import { YouPage } from "./you/YouPage";
import { Composer } from "./you/Composer";
import { createThread, deleteThread, listThreads, useThreads } from "./chat/threads";

export function HeadshotApp() {
  const store = useMemo(() => new BrainStore(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [selected, setSelected] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number; send?: boolean } | null>(null);
  const threads = useThreads();
  const [chosenThread, setChosenThread] = useState<string | null>(null);
  const threadId = chosenThread && threads.some((t) => t.id === chosenThread) ? chosenThread : (threads[0]?.id ?? null);
  const [surface, setSurface] = useState<Surface>("you");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

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

  /** Open a person or title in the drawer. */
  const select = useCallback((id: string) => {
    if (id === "me") return;
    setSelected(id);
  }, []);

  // "Show me X" from the agent, and /?open=: both land in the drawer.
  const egoReq = state.egoRequest;
  const [seenEgoReq, setSeenEgoReq] = useState<number | null>(null);
  if (egoReq && egoReq.nonce !== seenEgoReq) {
    setSeenEgoReq(egoReq.nonce);
    select(egoReq.imdbId);
  }

  /** Open a thread with `text` already asked: the composer, the drawer, /?q=. */
  const ask = useCallback(
    (text: string) => {
      const empty = listThreads().find((t) => t.title === "New thread");
      const t = empty ?? createThread();
      setChosenThread(t.id);
      setPrefill({ text, nonce: Date.now(), send: true });
      setSurface("chat");
      setMobileNav(false);
    },
    [],
  );

  // A question from /?q= or the agent opens a thread, which writes to storage
  // — a side effect, so it happens in an effect rather than during render. The
  // nonce is remembered in a ref: re-running must not re-ask.
  const prefillReq = state.prefillRequest;
  const askedNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!prefillReq || prefillReq.nonce === askedNonce.current) return;
    askedNonce.current = prefillReq.nonce;
    ask(prefillReq.text);
  }, [prefillReq, ask]);

  const expand = useCallback(
    async (imdbId: string) => {
      await fetch("/api/expand", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ imdbId }) }).catch(() => {});
      select(imdbId);
    },
    [select],
  );

  const goYou = () => {
    // Home is You: the log, the memory, tonight's row, the numbers.
    setSurface("you");
    setMobileNav(false);
    store.clearHighlight();
  };
  const newChat = () => {
    const t = createThread();
    setChosenThread(t.id);
    setSurface("chat");
    setMobileNav(false);
    store.clearHighlight();
  };
  const openThread = (id: string) => {
    setChosenThread(id);
    setSurface("chat");
    setMobileNav(false);
  };

  const sidebar = (
    <Sidebar
      surface={surface}
      threads={threads.filter((t) => t.title !== "New thread")}
      activeId={threadId}
      collapsed={collapsed}
      onToggle={() => setCollapsed((c) => !c)}
      onNew={newChat}
      onYou={goYou}
      onLater={() => {
        setSurface("later");
        setMobileNav(false);
      }}
      onTaste={() => {
        setSurface("taste");
        setMobileNav(false);
      }}
      onSelectThread={openThread}
      onDeleteThread={(id) => deleteThread(id)}
    />
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg">
      <div className="hidden h-full md:block">{sidebar}</div>
      {mobileNav && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="h-full">{sidebar}</div>
          <button className="flex-1 bg-black/60" aria-label="Close menu" onClick={() => setMobileNav(false)} />
        </div>
      )}

      <main className="relative flex h-full min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-line px-3 py-2 md:hidden">
          <button onClick={() => setMobileNav(true)} className="text-[13px] text-ink-dim" aria-label="Menu">
            ☰
          </button>
          <span className="text-[14px] font-semibold text-ink">Headshot</span>
          <button onClick={newChat} className="text-[13px] text-ink-dim">
            + New
          </button>
        </div>
        {surface === "you" && (
          <>
            <div className="scrollbar-thin flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[760px] px-6 py-8 md:px-8">
                <YouPage onSelectNode={select} onAsk={ask} />
              </div>
            </div>
            <Composer onSubmit={ask} />
          </>
        )}
        {surface === "chat" && threadId && (
          <ChatPanel key={threadId} threadId={threadId} store={store} prefill={prefill} onSelectNode={select} />
        )}
        {surface === "later" && (
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[760px] px-6 py-8 md:px-8">
              <LaterPanel onSelectNode={select} />
            </div>
          </div>
        )}
        {surface === "taste" && (
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[760px] px-6 py-8 md:px-8">
              <TastePanel onSelectNode={select} />
            </div>
          </div>
        )}
      </main>

      {/* The drawer: a title or a person, summoned by a tap */}
      {selected && (
        <div className="sheet fixed inset-0 z-40 md:static md:inset-auto md:z-auto md:h-full md:w-[420px] md:shrink-0 md:border-l md:border-line lg:w-[460px]">
          <div className="h-full p-3 md:p-4">
            <PagePanel
              key={selected}
              imdbId={selected}
              onClose={() => setSelected(null)}
              onSelectNode={select}
              onAsk={(text) => {
                ask(text);
                setSelected(null);
              }}
              onExpand={expand}
            />
          </div>
        </div>
      )}
    </div>
  );
}
