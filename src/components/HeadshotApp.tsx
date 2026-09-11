"use client";
/**
 * The shell, board C: `176px | 1fr` — the rail, then one content column with
 * the composer pinned at its bottom, and a 420px drawer behind one hairline on
 * the right (DESIGN.md → Layouts, Rhythm). Two surfaces only (SPEC v4): You
 * (home — the log, the memory, tonight, the numbers, later) and a thread. The
 * graph canvas is not part of the product surface and nothing links to it;
 * /brain keeps it for the curious.
 *
 * On a phone the rail becomes a 44px top bar (wordmark, `you` / `history`,
 * account — no hamburger), History opens the rail as a sheet, and the drawer
 * is full screen.
 *
 * One way in: You carries a composer, and anything typed there (or asked from
 * the drawer, or arriving on /?q=) opens a thread with the question already
 * sent. Threads are created lazily, so History never lists an empty one.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BrainStore } from "./canvas/brainStore";
import { ChatPanel } from "./chat/ChatPanel";
import { PagePanel } from "./page/PagePanel";
import { Sidebar } from "./Sidebar";
import { accountModel, accountName, type Surface } from "./navModel";
import { useSessionUser, requireSignIn } from "./auth/SignInGate";
import { YouPage } from "./you/YouPage";
import { Prompt } from "./you/Prompt";
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
  // Deleting the open thread drops us home rather than onto an empty column.
  const shown: Surface = surface === "chat" && threadId ? "chat" : "you";

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

  /**
   * Open a thread with `text` already asked: the composer, the drawer, /?q=.
   * A thread is only ever created here — there is no "New chat" button — so an
   * empty "New thread" exists for at most the moment before its first question
   * names it.
   */
  const ask = useCallback((text: string) => {
    const empty = listThreads().find((t) => t.title === "New thread");
    const t = empty ?? createThread();
    setChosenThread(t.id);
    setPrefill({ text, nonce: Date.now(), send: true });
    setSurface("chat");
    setMobileNav(false);
  }, []);

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
    // Home is You: the log, the memory, tonight's row, the numbers. No thread
    // is created on the way back.
    setSurface("you");
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
      surface={shown}
      threads={threads.filter((t) => t.title !== "New thread")}
      activeId={threadId}
      collapsed={collapsed}
      onToggle={() => setCollapsed((c) => !c)}
      onYou={goYou}
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

      {/* `overflow-clip`, not `hidden`: a focus inside the scroller (the account
          button, a composer below the fold) would otherwise scroll this column
          programmatically and shift the whole shell out of frame for good. */}
      <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-clip">
        <TopBar surface={shown} onYou={goYou} onHistory={() => setMobileNav(true)} />
        {shown === "you" && (
          <>
            <div className="scrollbar-thin flex-1 overflow-y-auto">
              <div className="w-full px-4 pb-[40px] pt-[22px] md:px-[34px]">
                <YouPage onSelectNode={select} onAsk={ask} />
              </div>
            </div>
            {/* The composer is on the landing signed in or out: trivia chat is open to everyone. */}
            <div className="px-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-[34px] sm:pb-[22px]">
              <Prompt onAsk={ask} onSelectNode={select} />
            </div>
          </>
        )}
        {shown === "chat" && threadId && (
          <ChatPanel key={threadId} threadId={threadId} store={store} prefill={prefill} onSelectNode={select} />
        )}
      </main>

      {/* The drawer: a region behind one hairline, 420px, full screen on a phone. */}
      {selected && (
        <div className="sheet fixed inset-0 z-40 md:static md:inset-auto md:z-auto md:h-full md:w-[420px] md:shrink-0 md:border-l md:border-line">
          <div className="h-full px-4 py-[22px] md:px-6">
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

/**
 * The phone's rail: 44px, wordmark left, `you` / `history` as text, account
 * right. No hamburger (DESIGN.md → Rhythm); `history` opens the rail as a
 * sheet, which is where the threads live.
 */
function TopBar({ surface, onYou, onHistory }: { surface: Surface; onYou: () => void; onHistory: () => void }) {
  const { user, loading } = useSessionUser();
  const account = accountModel(user, loading);
  return (
    <div className="flex h-[44px] shrink-0 items-center gap-[16px] border-b border-line px-4 md:hidden">
      <button onClick={onYou} className="text-[14px] font-bold leading-none tracking-[-0.02em] text-ink">
        headshot
      </button>
      <button onClick={onYou} className={`t-ui ${surface === "you" ? "text-ink" : "font-normal text-ink-faint"}`}>
        you
      </button>
      <button onClick={onHistory} className={`t-ui ${surface === "chat" ? "text-ink" : "font-normal text-ink-faint"}`}>
        history
      </button>
      <button
        onClick={() => (user ? onHistory() : requireSignIn(window.location.pathname))}
        className="t-meta ml-auto truncate text-ink-faint"
        title={account.label}
      >
        {accountName(account.label)}
      </button>
    </div>
  );
}
