"use client";
/**
 * The rail: 56px of icons on the left, nothing else. Tonight (home), a new
 * question, history (a popover of threads), the taste map, the brain, and the
 * account at the bottom. The old sidebar's real estate goes to the reading
 * column; the brain is a panel you summon, not half the screen.
 */
import { useState } from "react";
import type { ThreadMeta } from "./chat/threads";
import { requireSignIn, signOut, useSessionUser } from "./auth/SignInGate";

export type Surface = "tonight" | "map" | "brain" | "chat";

interface Props {
  surface: Surface;
  threads: ThreadMeta[];
  activeId: string | null;
  onHome: () => void;
  onNew: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onMap: () => void;
  onBrain: () => void;
}

export function Rail({ surface, threads, activeId, onHome, onNew, onSelectThread, onDeleteThread, onMap, onBrain }: Props) {
  const [history, setHistory] = useState(false);
  const { user, loading } = useSessionUser();
  const item = (key: string, label: string, active: boolean, onClick: () => void, icon: React.ReactNode) => (
    <button
      key={key}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`group relative flex size-10 items-center justify-center rounded-lg transition-colors duration-[120ms] ${active ? "bg-white/[0.06] text-ink" : "text-ink-dim hover:bg-white/[0.04] hover:text-ink"}`}
    >
      {icon}
      <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md border border-line bg-elev px-2 py-1 text-[11.5px] text-ink opacity-0 shadow-lg transition-opacity duration-[120ms] group-hover:opacity-100">
        {label}
      </span>
    </button>
  );

  return (
    <aside className="relative z-30 flex h-full w-14 shrink-0 flex-col items-center border-r border-line bg-bg py-3" aria-label="Navigation">
      <button onClick={onHome} className="mb-3 flex size-10 items-center justify-center" title="Headshot" aria-label="Headshot home">
        <span className="inline-block size-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" />
      </button>
      <div className="flex flex-col items-center gap-1">
        {item("tonight", "Tonight", surface === "tonight", onHome, <Icon.home />)}
        {item("new", "New question", false, onNew, <Icon.plus />)}
        {item("history", "History", history, () => setHistory((h) => !h), <Icon.clock />)}
        {item("map", "Taste map", surface === "map", onMap, <Icon.map />)}
        {item("brain", "The brain", surface === "brain", onBrain, <Icon.brain />)}
      </div>
      <div className="mt-auto flex flex-col items-center gap-1">
        {loading ? (
          <span className="size-10" />
        ) : user ? (
          item("account", `${user.email ?? "Signed in"} · sign out`, false, () => void signOut(), <span className="flex size-6 items-center justify-center rounded-full bg-accent/20 text-[11px] font-semibold text-accent">{(user.email ?? "?")[0].toUpperCase()}</span>)
        ) : (
          item("signin", "Sign in", false, () => requireSignIn(window.location.pathname), <Icon.user />)
        )}
      </div>

      {history && (
        <div className="absolute left-full top-14 z-40 ml-2 w-[300px] rounded-xl border border-line bg-elev p-2 shadow-[0_24px_60px_rgba(0,0,0,0.5)]" role="dialog" aria-label="History">
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">Threads</span>
            <button onClick={() => setHistory(false)} className="text-ink-faint hover:text-ink" aria-label="Close">
              <Icon.x />
            </button>
          </div>
          <div className="scrollbar-thin max-h-[60vh] overflow-y-auto">
            {threads.length === 0 && <p className="px-2 py-3 text-[12.5px] text-ink-faint">Nothing yet.</p>}
            {threads.map((t) => (
              <div key={t.id} className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] ${t.id === activeId ? "bg-white/[0.06] text-ink" : "text-ink-dim hover:bg-white/[0.04] hover:text-ink"}`}>
                <button
                  onClick={() => {
                    onSelectThread(t.id);
                    setHistory(false);
                  }}
                  className="min-w-0 flex-1 truncate text-left"
                >
                  {t.title}
                </button>
                <button onClick={() => onDeleteThread(t.id)} className="rounded p-1 text-ink-faint opacity-0 hover:text-danger group-hover:opacity-100" aria-label="Delete thread">
                  <Icon.x />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Icon = {
  home: () => (
    <svg width="18" height="18" viewBox="0 0 20 20" {...stroke}>
      <path d="M3 9.5 10 3l7 6.5V17h-4.5v-4h-5v4H3z" />
    </svg>
  ),
  plus: () => (
    <svg width="18" height="18" viewBox="0 0 20 20" {...stroke}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  ),
  clock: () => (
    <svg width="18" height="18" viewBox="0 0 20 20" {...stroke}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l3 2" />
    </svg>
  ),
  map: () => (
    <svg width="18" height="18" viewBox="0 0 20 20" {...stroke}>
      <circle cx="10" cy="10" r="2.5" />
      <circle cx="4" cy="5" r="1.5" />
      <circle cx="16" cy="5" r="1.5" />
      <circle cx="4" cy="15" r="1.5" />
      <circle cx="16" cy="15" r="1.5" />
      <path d="M5.2 6.2 8.2 8.4M14.8 6.2l-3 2.2M5.2 13.8l3-2.2M14.8 13.8l-3-2.2" />
    </svg>
  ),
  brain: () => (
    <svg width="18" height="18" viewBox="0 0 20 20" {...stroke}>
      <path d="M7 3.5a3 3 0 0 0-3 3v1a3 3 0 0 0 0 5v1a3 3 0 0 0 3 3h1V3.5zM13 3.5a3 3 0 0 1 3 3v1a3 3 0 0 1 0 5v1a3 3 0 0 1-3 3h-1V3.5z" />
    </svg>
  ),
  user: () => (
    <svg width="18" height="18" viewBox="0 0 20 20" {...stroke}>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M3.5 17a6.5 6.5 0 0 1 13 0" />
    </svg>
  ),
  x: () => (
    <svg width="14" height="14" viewBox="0 0 20 20" {...stroke}>
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  ),
};
