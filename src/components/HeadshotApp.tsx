"use client";
/**
 * The shell, v5: `232px | 1fr` — the rail, then one content column, and a
 * 420px drawer behind one hairline on the right (DESIGN.md → Layouts).
 * Three surfaces and nothing else: Log (the product, and where a signed-in
 * person lands), Ask (the interface to it, and the landing signed out) and You
 * (the receipt). Log carries its own field, so it is the one surface with no
 * composer pinned under it.
 *
 * On a phone the rail becomes a 44px top bar plus a bottom tab bar; on Ask the
 * top bar's `chats` opens the rail as a sheet, which is where the sessions
 * live.
 *
 * Threads: signed in they are the server's (`/api/threads`), listed under Ask
 * and re-read after every finished turn; signed out one thread lives in
 * localStorage and is never listed.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BrainStore } from "./canvas/brainStore";
import { ChatPanel } from "./chat/ChatPanel";
import { PagePanel } from "./page/PagePanel";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { PlusIcon } from "./navIcons";
import { type Section, type Surface } from "./navModel";
import { useSessionUser } from "./auth/SignInGate";
import { LogPage } from "./log/LogPage";
import { YouPage } from "./you/YouPage";
import type { LogFilter } from "./you/numbersRules";
import { useWelcomeRedirect } from "./welcome/useWelcomeRedirect";
import type { HeadshotUIMessage } from "@/lib/agent/events";
import { createThread, deleteThread, listThreads, useThreads } from "./chat/threads";
import { loadServerThread, useServerThreads } from "./chat/serverThreads";

/** `/?surface=log|ask|you`, read after hydration so the server HTML stays stable. */
function useLinkedSurface(): Surface | null {
  return useSyncExternalStore(
    () => () => {},
    () => {
      const want = new URLSearchParams(window.location.search).get("surface");
      return want === "log" || want === "ask" || want === "you" ? want : null;
    },
    () => null,
  );
}

export function HeadshotApp() {
  const store = useMemo(() => new BrainStore(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [selected, setSelected] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number; send?: boolean } | null>(null);

  const { user: sessionUser } = useSessionUser();
  const signedIn = Boolean(sessionUser);
  const server = useServerThreads(signedIn);

  // The open thread is derived, not stored: `opened` is only ever set by an
  // action (picking one from the rail), and with nothing picked Ask shows a
  // fresh chat — which is the tonight opener. Signed out there is one thread
  // and it is the local one, so a reload comes back to it.
  const [opened, setOpened] = useState<{ id: string; messages: HeadshotUIMessage[] } | null>(null);
  const [freshId, setFreshId] = useState(() => crypto.randomUUID());
  /** A stored thread whose messages are still in flight. */
  const [opening, setOpening] = useState<string | null>(null);
  const localThreads = useThreads();

  // Where a signed-in person lands is the Log (SPEC v5); signed out there is
  // no log, so Ask is the landing. `chosen` is null until someone navigates,
  // so the default can still change under it when the session resolves.
  const [chosen, setChosen] = useState<Surface | null>(null);
  // `/?surface=ask` is how a page outside the shell (`/settings`) gets back to
  // one. Read rather than stored: the moment anything here navigates, `chosen`
  // wins, and a reload comes back to the surface the link named.
  const linked = useLinkedSurface();
  const surface: Surface = chosen ?? linked ?? (signedIn ? "log" : "ask");
  const [mobileNav, setMobileNav] = useState(false);
  /** The chip the Log opens on, and a nonce so the same one can be asked twice. */
  const [logFilter, setLogFilter] = useState<{ value: LogFilter; nonce: number } | null>(null);

  // A brand-new account is sent through `/welcome` once, and only once.
  useWelcomeRedirect(sessionUser?.id ?? null);

  const localId = localThreads[0]?.id;
  const thread = useMemo(
    () => opened ?? { id: signedIn ? freshId : (localId ?? freshId), messages: [] as HeadshotUIMessage[] },
    [opened, signedIn, freshId, localId],
  );

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
   * A fresh chat, optionally with its first question already in flight. The id
   * is the client's (the transport carries it on the first turn), so the row
   * exists before the route has to store anything against it.
   */
  const newChat = useCallback(
    (text?: string) => {
      setOpening(null);
      setOpened(null);
      // Signed out there is one thread, reused: unlisted threads must not pile up.
      if (signedIn) setFreshId(crypto.randomUUID());
      setChosen("ask");
      setMobileNav(false);
      if (text) setPrefill({ text, nonce: Date.now(), send: true });
    },
    [signedIn],
  );

  /**
   * The row for the open thread, created the moment before its first turn is
   * sent — so the route always has somewhere to store it, and a chat nobody
   * asked anything in never appears in the rail.
   */
  const created = useRef(new Set<string>());
  const ensureThread = useCallback(
    async (id: string) => {
      if (created.current.has(id)) return;
      created.current.add(id);
      if (signedIn) await server.create({ id });
      else if (!listThreads().some((t) => t.id === id)) createThread(id);
    },
    [signedIn, server],
  );

  /**
   * Open a thread with `text` already asked: the drawer, You, /?q=. Signed out
   * there is one thread and it is reused rather than piling up unlisted ones.
   */
  const ask = useCallback((text: string) => newChat(text), [newChat]);

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

  /** Read a stored thread and show it. */
  const openThread = useCallback((id: string) => {
    setChosen("ask");
    setMobileNav(false);
    setOpening(id);
    void loadServerThread(id).then((t) => {
      created.current.add(id);
      setOpened({ id, messages: (t?.messages ?? []) as HeadshotUIMessage[] });
      setOpening(null);
    });
  }, []);

  const expand = useCallback(
    async (imdbId: string) => {
      await fetch("/api/expand", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ imdbId }) }).catch(() => {});
      select(imdbId);
    },
    [select],
  );

  const goTo = (section: Section) => {
    setChosen(section);
    setMobileNav(false);
    store.clearHighlight();
  };

  const removeThread = (id: string) => {
    if (signedIn) void server.remove(id);
    else deleteThread(id);
    created.current.delete(id);
    // Deleting the open thread drops us on a fresh new chat, not an empty column.
    if (thread.id === id) newChat();
  };

  const onFirstQuestion = useCallback(
    (text: string) => {
      if (!signedIn) return;
      const known = server.threads.find((t) => t.id === thread.id);
      if (known && known.title) return;
      void server.rename(thread.id, text);
    },
    [signedIn, thread, server],
  );

  // The open chat is whichever thread the column is showing — a fresh one has
  // no row yet, and the row it gets the moment it is asked something is the
  // one the rail must mark. `opened` alone left every row dim.
  const railProps = {
    surface,
    sessions: signedIn ? server.threads : [],
    activeId: thread.id,
    onNavigate: goTo,
    onNewChat: () => newChat(),
    onSelectThread: openThread,
    onRenameThread: (id: string, title: string) => void server.rename(id, title),
    onDeleteThread: removeThread,
  };
  const sidebar = <Sidebar {...railProps} />;

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg">
      <div className="hidden h-full md:block">{sidebar}</div>
      {/* The phone's `chats` sheet. The three sections are the tab bar and the
          wordmark is in the top bar, so the sheet is the chats and nothing
          else — repeating the nav here would be the same control twice. */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="h-full">
            <Sidebar {...railProps} variant="sheet" />
          </div>
          <button className="flex-1 bg-black/60" aria-label="Close chats" onClick={() => setMobileNav(false)} />
        </div>
      )}

      {/* `overflow-clip`, not `hidden`: a focus inside the scroller (the account
          button, a composer below the fold) would otherwise scroll this column
          programmatically and shift the whole shell out of frame for good. */}
      <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-clip">
        <TopBar surface={surface} signedIn={signedIn} onNavigate={goTo} onChats={() => setMobileNav(true)} onNewChat={() => newChat()} />
        {surface === "log" && (
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {/* Log carries its own field at the top, so no composer is pinned
                under it and the whole column scrolls with the table. */}
            <div className="w-full px-4 pb-[32px] pt-[22px] md:px-[34px]">
              {/* keyed on the request so arriving from Later re-opens the table
                  on its chip rather than leaving the old one selected */}
              <LogPage key={logFilter?.nonce ?? "log"} onSelectNode={select} initialFilter={logFilter?.value} />
            </div>
          </div>
        )}
        {surface === "you" && (
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            <div className="w-full px-4 pb-[40px] pt-[22px] md:px-[34px]">
              <YouPage
                onSelectNode={select}
                onGoToLog={(filter) => {
                  setLogFilter(filter ? { value: filter, nonce: Date.now() } : null);
                  goTo("log");
                }}
              />
            </div>
          </div>
        )}
        {surface === "ask" && !opening && (
          <ChatPanel
            key={thread.id}
            threadId={thread.id}
            initialMessages={thread.messages}
            signedIn={signedIn}
            store={store}
            prefill={prefill}
            onSelectNode={select}
            onTurnFinished={() => signedIn && server.refresh()}
            onFirstQuestion={onFirstQuestion}
            onBeforeFirstSend={() => ensureThread(thread.id)}
          />
        )}
        {surface === "ask" && opening && (
          <div className="flex-1 px-4 pt-[50px] md:px-[34px]">
            <p className="t-meta mx-auto w-full max-w-[720px]">opening…</p>
          </div>
        )}
        <TabBar surface={surface} onNavigate={goTo} />
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
 * The phone's top bar: 44px, the wordmark, and — on Ask, signed in — the way
 * into this section's sessions (`design/boards-v5/Shell-phone.dc.html`). The
 * sections themselves are the bottom tab bar now.
 */
function TopBar({
  surface,
  signedIn,
  onNavigate,
  onChats,
  onNewChat,
}: {
  surface: Surface;
  signedIn: boolean;
  onNavigate: (section: Section) => void;
  onChats: () => void;
  onNewChat: () => void;
}) {
  return (
    <div className="flex h-[44px] shrink-0 items-center gap-[10px] border-b border-line px-4 md:hidden">
      <button onClick={() => onNavigate(signedIn ? "log" : "ask")} className="flex h-[44px] items-center text-[14px] font-bold leading-none tracking-[-0.02em] text-ink">
        headshot
      </button>
      {surface === "ask" && signedIn && (
        <>
          {/* Both controls keep the board's position and take a 44px hit area
              around it — a 13px word and a 16px glyph are not a touch target. */}
          <button onClick={onChats} className="ml-auto -mr-[6px] flex h-[44px] items-center px-[6px] text-[13px] leading-none text-ink-faint">
            chats
          </button>
          <button onClick={onNewChat} aria-label="New chat" className="-mr-[14px] flex h-[44px] w-[44px] items-center justify-center text-ink">
            <PlusIcon size={16} />
          </button>
        </>
      )}
    </div>
  );
}
