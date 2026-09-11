"use client";
/**
 * The sidebar, ChatGPT-shaped: collapsible to a 56px strip of icons, expanded
 * to 260px with New chat, Tonight, Later, then the history list, and the
 * account at the bottom as a menu (never a one-tap sign-out).
 */
import { useState } from "react";
import type { ThreadMeta } from "./chat/threads";
import { requireSignIn, signOut, useSessionUser } from "./auth/SignInGate";

export type Surface = "tonight" | "later" | "taste" | "chat";

interface Props {
  surface: Surface;
  threads: ThreadMeta[];
  activeId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onNew: () => void;
  onTonight: () => void;
  onLater: () => void;
  onTaste: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
}

export function Sidebar({ surface, threads, activeId, collapsed, onToggle, onNew, onTonight, onLater, onTaste, onSelectThread, onDeleteThread }: Props) {
  const [menu, setMenu] = useState(false);
  const { user, loading } = useSessionUser();

  const nav = [
    { key: "new", label: "New chat", onClick: onNew, icon: <Icon.plus />, active: false },
    { key: "tonight", label: "Tonight", onClick: onTonight, icon: <Icon.home />, active: surface === "tonight" },
    { key: "later", label: "Later", onClick: onLater, icon: <Icon.bookmark />, active: surface === "later" },
  ] as const;

  const accountLabel = loading ? "…" : user ? (user.email ?? "Signed in") : "Sign in";

  if (collapsed) {
    return (
      <aside className="flex h-full w-14 shrink-0 flex-col items-center border-r border-line bg-bg py-3" aria-label="Sidebar">
        <button onClick={onToggle} className="mb-2 flex size-10 items-center justify-center rounded-lg text-ink-dim hover:bg-white/[0.04] hover:text-ink" aria-label="Expand sidebar" title="Expand">
          <Icon.panel />
        </button>
        {nav.map((n) => (
          <button key={n.key} onClick={n.onClick} title={n.label} aria-label={n.label} className={`flex size-10 items-center justify-center rounded-lg transition-colors duration-[120ms] ${n.active ? "bg-white/[0.06] text-ink" : "text-ink-dim hover:bg-white/[0.04] hover:text-ink"}`}>
            {n.icon}
          </button>
        ))}
        <div className="mt-auto">
          <button onClick={() => (user ? onToggle() : requireSignIn(window.location.pathname))} className="flex size-10 items-center justify-center rounded-lg text-ink-dim hover:bg-white/[0.04] hover:text-ink" title={accountLabel} aria-label={accountLabel}>
            {user ? <Avatar email={user.email} /> : <Icon.user />}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="relative flex h-full w-[260px] shrink-0 flex-col border-r border-line bg-bg" aria-label="Sidebar">
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <button onClick={onTonight} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/[0.04]">
          <span className="inline-block size-2 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
          <span className="text-[14px] font-semibold tracking-tight text-ink">Headshot</span>
        </button>
        <button onClick={onToggle} className="rounded-md p-1.5 text-ink-dim hover:bg-white/[0.04] hover:text-ink" aria-label="Collapse sidebar" title="Collapse">
          <Icon.panel />
        </button>
      </div>

      <nav className="px-2 pt-1" aria-label="Surfaces">
        {nav.map((n) => (
          <button key={n.key} onClick={n.onClick} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left text-[13.5px] transition-colors duration-[120ms] ${n.active ? "bg-white/[0.06] text-ink" : "text-ink-dim hover:bg-white/[0.04] hover:text-ink"}`}>
            <span className="text-ink-faint">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      <div className="mt-4 px-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">History</div>
      <nav className="scrollbar-thin mt-1 flex-1 overflow-y-auto px-2" aria-label="History">
        {threads.length === 0 && <p className="px-2.5 py-2 text-[12.5px] text-ink-faint">Nothing yet.</p>}
        {threads.map((t) => (
          <div key={t.id} className={`group flex items-center gap-1 rounded-md px-2.5 py-[6px] text-[13px] ${t.id === activeId && surface === "chat" ? "bg-white/[0.06] text-ink" : "text-ink-dim hover:bg-white/[0.04] hover:text-ink"}`}>
            <button onClick={() => onSelectThread(t.id)} className="min-w-0 flex-1 truncate text-left">
              {t.title}
            </button>
            <button onClick={() => onDeleteThread(t.id)} className="rounded p-1 text-ink-faint opacity-0 hover:text-danger group-hover:opacity-100" aria-label="Delete thread" title="Delete">
              <Icon.x />
            </button>
          </div>
        ))}
      </nav>

      <div className="relative border-t border-line p-2">
        {menu && user && (
          <div className="absolute bottom-full left-2 right-2 mb-2 rounded-xl border border-line bg-elev p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.5)]" role="menu">
            <div className="truncate px-2.5 py-2 text-[12.5px] text-ink-dim">{user.email}</div>
            <button onClick={() => { setMenu(false); onTaste(); }} className="block w-full rounded-md px-2.5 py-2 text-left text-[13px] text-ink hover:bg-white/[0.05]">
              Your taste
            </button>
            <button onClick={() => { setMenu(false); onLater(); }} className="block w-full rounded-md px-2.5 py-2 text-left text-[13px] text-ink hover:bg-white/[0.05]">
              Later
            </button>
            <a href="/onboarding" className="block w-full rounded-md px-2.5 py-2 text-left text-[13px] text-ink hover:bg-white/[0.05]">
              Services and imports
            </a>
            <div className="my-1 h-px bg-line" />
            <button onClick={() => void signOut()} className="block w-full rounded-md px-2.5 py-2 text-left text-[13px] text-ink-dim hover:bg-white/[0.05] hover:text-ink">
              Sign out
            </button>
          </div>
        )}
        <button
          onClick={() => (user ? setMenu((m) => !m) : requireSignIn(window.location.pathname))}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-dim hover:bg-white/[0.04] hover:text-ink"
          aria-haspopup={user ? "menu" : undefined}
          aria-expanded={menu}
        >
          {user ? <Avatar email={user.email} /> : <Icon.user />}
          <span className="min-w-0 flex-1 truncate">{accountLabel}</span>
          {user && <Icon.dots />}
        </button>
      </div>
    </aside>
  );
}

function Avatar({ email }: { email: string | null }) {
  return <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-semibold text-accent">{(email ?? "?")[0].toUpperCase()}</span>;
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Icon = {
  home: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" {...stroke}>
      <path d="M3 9.5 10 3l7 6.5V17h-4.5v-4h-5v4H3z" />
    </svg>
  ),
  plus: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" {...stroke}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  ),
  bookmark: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" {...stroke}>
      <path d="M5 3h10v14l-5-3.5L5 17z" />
    </svg>
  ),
  panel: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" {...stroke}>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M8 4v12" />
    </svg>
  ),
  user: () => (
    <svg width="16" height="16" viewBox="0 0 20 20" {...stroke}>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M3.5 17a6.5 6.5 0 0 1 13 0" />
    </svg>
  ),
  dots: () => (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
      <circle cx="4" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="16" cy="10" r="1.5" />
    </svg>
  ),
  x: () => (
    <svg width="14" height="14" viewBox="0 0 20 20" {...stroke}>
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  ),
};
