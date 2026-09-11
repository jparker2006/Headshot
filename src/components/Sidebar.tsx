"use client";
/**
 * The rail, board C (DESIGN.md → Sidebar): 176px, one hairline on the right,
 * padding 22/0/22/24, internal gap 26. Wordmark, then `you` / `history` at
 * 13.5px where the ink level *is* the state (no pill, no icon, no counter),
 * then the threads under History, then the account name pushed to the bottom.
 *
 * Collapsed it keeps the same ground and the same type — just the wordmark's
 * initial and the account's — because the doc has no second visual language
 * for a rail. The nav itself is decided in `navModel.ts` so the cuts are
 * testable.
 */
import { useState } from "react";
import type { ThreadMeta } from "./chat/threads";
import { shortAgo } from "./chat/threadMeta";
import { requireSignIn, signOut, useSessionUser } from "./auth/SignInGate";
import { accountModel, accountName, navItems, type Surface } from "./navModel";

export type { Surface };

interface Props {
  surface: Surface;
  threads: ThreadMeta[];
  activeId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  /** Home. */
  onYou: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
}

export function Sidebar({ surface, threads, activeId, collapsed, onToggle, onYou, onSelectThread, onDeleteThread }: Props) {
  const [menu, setMenu] = useState(false);
  const { user, loading } = useSessionUser();

  const nav = navItems(surface);
  const account = accountModel(user, loading);
  const signIn = () => requireSignIn(typeof window === "undefined" ? "/" : window.location.pathname);

  if (collapsed) {
    return (
      <aside className="flex h-full w-[56px] shrink-0 flex-col items-start gap-[26px] border-r border-line bg-bg py-[22px] pl-[20px]" aria-label="Sidebar">
        <button onClick={onToggle} className="text-[14px] font-bold leading-none tracking-[-0.02em] text-ink" aria-label="Expand sidebar" title="headshot">
          h
        </button>
        {nav.map((n) => (
          <button key={n.key} onClick={onYou} title={n.label} aria-label={n.label} className={`t-ui ${n.active ? "text-ink" : "text-ink-faint hover:text-ink"} transition-colors duration-[120ms]`}>
            {n.label[0]}
          </button>
        ))}
        <button onClick={() => (user ? onToggle() : signIn())} className="t-meta mt-auto text-ink-faint transition-colors duration-[120ms] hover:text-ink" title={account.label} aria-label={account.label}>
          {accountName(account.label)[0] ?? "?"}
        </button>
      </aside>
    );
  }

  return (
    // 176px is the rail; as a phone sheet it gets 260px so a thread's own
    // question is readable instead of truncating after four words.
    <aside className="group/rail relative flex h-full w-[260px] shrink-0 flex-col gap-[26px] border-r border-line bg-bg py-[22px] pl-[24px] md:w-[176px]" aria-label="Sidebar">
      <div className="flex items-baseline">
        <button onClick={onYou} className="text-[14px] font-bold leading-none tracking-[-0.02em] text-ink">
          headshot
        </button>
        <button
          onClick={onToggle}
          className="t-meta ml-auto mr-[10px] opacity-0 transition-opacity duration-[120ms] hover:text-ink group-hover/rail:opacity-100"
          aria-label="Collapse sidebar"
          title="Collapse"
        >
          «
        </button>
      </div>

      <nav className="flex flex-col gap-[7px]" aria-label="Surfaces">
        {nav.map((n) => (
          <button
            key={n.key}
            onClick={onYou}
            className={`t-ui text-left transition-colors duration-[120ms] ${n.active ? "text-ink" : "font-normal text-ink-faint hover:text-ink"}`}
          >
            {n.label}
          </button>
        ))}
        <span className={`t-ui ${surface === "chat" ? "text-ink" : "font-normal text-ink-faint"}`}>history</span>
      </nav>

      <nav className="scrollbar-thin mt-[4px] flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto pr-[12px]" aria-label="History">
        {threads.length === 0 && <span className="t-meta">nothing asked yet</span>}
        {threads.map((t) => {
          const on = t.id === activeId && surface === "chat";
          return (
            <div key={t.id} className="group/row flex flex-col gap-[6px]">
              <div className="flex items-start gap-[6px]">
                <button onClick={() => onSelectThread(t.id)} className={`min-w-0 flex-1 truncate text-left text-[13px] leading-[1.3] transition-colors duration-[120ms] ${on ? "text-ink" : "text-ink-dim hover:text-ink"}`}>
                  {t.title}
                </button>
                <button
                  onClick={() => onDeleteThread(t.id)}
                  className="t-meta shrink-0 opacity-0 transition-opacity duration-[120ms] hover:text-ink group-hover/row:opacity-100"
                  aria-label="Delete thread"
                  title="Delete"
                >
                  ×
                </button>
              </div>
              <span className="t-meta">{shortAgo(t.createdAt)}</span>
            </div>
          );
        })}
      </nav>

      <div className="relative mt-auto flex flex-col gap-[5px] pr-[12px]">
        {menu && user && (
          <div className="panel absolute bottom-full left-0 mb-[10px] w-[200px] p-[10px]" role="menu">
            <div className="t-meta truncate pb-[8px]">{user.email}</div>
            <button onClick={() => void signOut()} className="t-ui block w-full text-left text-ink-dim transition-colors duration-[120ms] hover:text-ink">
              Sign out
            </button>
          </div>
        )}
        <button
          onClick={() => (user ? setMenu((m) => !m) : signIn())}
          className="t-meta truncate text-left text-ink-faint transition-colors duration-[120ms] hover:text-ink"
          title={account.label}
          aria-haspopup={user ? "menu" : undefined}
          aria-expanded={menu}
        >
          {accountName(account.label)}
        </button>
      </div>
    </aside>
  );
}
