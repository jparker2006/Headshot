"use client";
import type { ThreadMeta } from "./chat/threads";
import { AccountRow } from "./auth/AccountRow";

interface Props {
  threads: ThreadMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  stats: { nodes: number; edges: number; mine: number };
  onShowBrain: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ threads, activeId, onSelect, onNew, onDelete, stats, onShowBrain, collapsed, onToggle }: Props) {
  if (collapsed) {
    return (
      <aside className="flex h-full w-12 flex-col items-center gap-2 border-r border-line bg-elev/60 py-3">
        <button onClick={onToggle} className="rounded-md p-2 text-ink-dim hover:bg-white/5 hover:text-ink" aria-label="Open sidebar" title="Open sidebar">
          <Glyph.menu />
        </button>
        <button onClick={onNew} className="rounded-md p-2 text-ink-dim hover:bg-white/5 hover:text-ink" aria-label="New thread" title="New thread">
          <Glyph.plus />
        </button>
      </aside>
    );
  }
  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-line bg-elev/60">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <div className="flex items-center gap-2 px-1">
          <span className="inline-block size-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" />
          <span className="text-[15px] font-semibold tracking-tight text-ink">Headshot</span>
        </div>
        <button onClick={onToggle} className="rounded-md p-1.5 text-ink-dim hover:bg-white/5 hover:text-ink" aria-label="Collapse sidebar" title="Collapse sidebar">
          <Glyph.menu />
        </button>
      </div>
      <div className="px-3">
        <button onClick={onNew} className="flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] text-ink hover:border-line-strong hover:bg-white/5">
          <Glyph.plus />
          New thread
        </button>
      </div>
      <div className="mt-3 px-4 text-[10.5px] uppercase tracking-wider text-ink-faint">Threads</div>
      <nav className="scrollbar-thin mt-1 flex-1 overflow-y-auto px-2">
        {threads.map((t) => (
          <div
            key={t.id}
            className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] ${t.id === activeId ? "bg-white/[0.07] text-ink" : "text-ink-dim hover:bg-white/[0.04] hover:text-ink"}`}
          >
            <button onClick={() => onSelect(t.id)} className="min-w-0 flex-1 truncate text-left">
              {t.title}
            </button>
            <button
              onClick={() => onDelete(t.id)}
              className="rounded p-1 text-ink-faint opacity-0 hover:text-danger group-hover:opacity-100"
              aria-label="Delete thread"
              title="Delete"
            >
              <Glyph.x />
            </button>
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-4 py-3">
        <button onClick={onShowBrain} className="w-full text-left">
          <div className="text-[10.5px] uppercase tracking-wider text-ink-faint">The brain</div>
          <div className="mt-0.5 font-mono text-[11.5px] text-ink-dim">
            {stats.nodes.toLocaleString()} nodes · {stats.edges.toLocaleString()} edges
          </div>
          {stats.mine > 0 && <div className="font-mono text-[11.5px] text-session">{stats.mine} added by you</div>}
        </button>
      </div>
      <div className="border-t border-line px-4 py-2.5">
        <AccountRow />
      </div>
    </aside>
  );
}

const Glyph = {
  menu: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    </svg>
  ),
  plus: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 2.5v11M2.5 8h11" />
    </svg>
  ),
  x: () => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  ),
};
