"use client";
/**
 * You — home, drawn to board C (`design/boards-v4/C-You.dc.html`).
 *
 * Order is fixed by DESIGN.md: memory, recently logged, tonight, numbers,
 * services, imports, later, the swipe button. Sections separate by 38px of
 * air and one hairline under each header — no card gets a border, no figure
 * gets a tile, and the only amber thing on the page is the first Play.
 *
 * There is no log box at the top: the one prompt lives at the bottom of every
 * screen (`Prompt`), and it tells this page through `logBus` when it writes.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { lookupName } from "@/components/chat/lookup";
import { useImages } from "@/components/chat/useImages";
import { useNames } from "@/components/chat/useNames";
import { useSessionUser, signInHref } from "@/components/auth/SignInGate";
import { LaterPanel } from "@/components/tonight/LaterPanel";
import { TonightPanel } from "@/components/tonight/TonightPanel";
import { Numbers } from "./Numbers";
import { MemoryProse } from "./MemoryProse";
import { ServicesChecklist } from "./ServicesChecklist";
import { Imports } from "./Imports";
import { Onboarding } from "./Onboarding";
import { SwipeSession } from "./SwipeSession";
import { bumpLog, useLogVersion } from "./logBus";
import { terseTime } from "./recent";
import { isNewAccount } from "./swipeRules";
import { useNumbers } from "./useNumbers";
import type { WatchedRow } from "@/lib/taste/types";

interface Props {
  /** Open a person or title in the drawer. */
  onSelectNode: (imdbId: string) => void;
  /** Put a question to the agent; the shell opens a thread with it. */
  onAsk: (text: string) => void;
}

export function YouPage({ onSelectNode, onAsk }: Props) {
  const { user, loading } = useSessionUser();
  const version = useLogVersion();
  const [allNumbers, setAllNumbers] = useState(false);
  /** "you" is the page; "swipe" is the deck inline, in its place. No route. */
  const [mode, setMode] = useState<"you" | "swipe">("you");
  /**
   * Deck-first onboarding for a new account — one whose log is empty. Decided
   * once, from the first read of the log: the flow's own first step fills the
   * log, and re-deriving the answer would throw the user out of their own
   * onboarding halfway through it.
   */
  const [flow, setFlow] = useState<"unknown" | "onboarding" | "you">("unknown");
  const decided = useRef(false);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || decided.current) return;
    let alive = true;
    const settle = (rows: unknown[] | null) => {
      if (!alive || decided.current) return;
      decided.current = true;
      setFlow(isNewAccount(rows) ? "onboarding" : "you");
    };
    fetch("/api/taste/watched", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { watched: unknown[] }).watched : null))
      .then(settle)
      .catch(() => settle(null));
    return () => {
      alive = false;
    };
  }, [userId]);

  if (loading) return <p className="t-meta">…</p>;

  if (!user) {
    return (
      <section className="flex max-w-[560px] flex-col items-start gap-[22px]" aria-label="You">
        <p className="text-[26px] font-semibold leading-[1.25] tracking-[-0.02em] text-ink">
          I keep the log of everything you have watched, and I know what it says about you.
        </p>
        <p className="t-meta">no password, ever. the chat below works without an account.</p>
        <Link href={signInHref("/")} className="btn btn-outline">
          Sign in
        </Link>
      </section>
    );
  }

  // The log has not been read yet: one quiet line rather than a flash of the
  // empty sections a new account must never see.
  if (flow === "unknown") return <p className="t-meta">…</p>;
  if (flow === "onboarding") return <Onboarding onDone={() => setFlow("you")} onSelectNode={onSelectNode} />;
  if (mode === "swipe") return <SwipeSession onExit={() => setMode("you")} onSelectNode={onSelectNode} />;

  return (
    <div className="flex flex-col gap-[28px] sm:gap-[38px]" aria-label="You">
      <Memory onSelectNode={onSelectNode} version={version} />
      <RecentlyLogged onSelectNode={onSelectNode} version={version} onWholeLog={() => setAllNumbers(true)} />
      <TonightPanel onSelectNode={onSelectNode} onAsk={onAsk} initial={1} />
      <div id="numbers">
        <Numbers onSelectNode={onSelectNode} version={version} open={allNumbers} onToggle={() => setAllNumbers((v) => !v)} />
      </div>
      <ServicesChecklist />
      <Imports onDone={bumpLog} />
      <LaterPanel onSelectNode={onSelectNode} />
      <div>
        {/* The deck is a state of this page, not a route (SPEC v4 → Surfaces). */}
        <button type="button" onClick={() => setMode("swipe")} className="btn btn-quiet">
          Swipe through ones you have probably seen
        </button>
      </div>
    </div>
  );
}

// ---- what I know about you -------------------------------------------------

interface MemoryRow {
  markdown: string;
  pinned: string;
  /** Null until the rewrite job has written once. */
  updatedAt: string | null;
}

/**
 * The page's opening, so its header carries no rule — it needs no seam
 * (DESIGN.md → You → Memory). `edit` writes the pinned block, which the
 * rewrite job copies through verbatim.
 */
function Memory({ onSelectNode, version }: { onSelectNode: (imdbId: string) => void; version: number }) {
  const [memory, setMemory] = useState<MemoryRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/taste/memory", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as MemoryRow) : null))
      .then((m) => alive && m && setMemory(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [version]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/taste/memory", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pinned: draft }),
      });
      if (r.ok) {
        setMemory((m) => ({ markdown: m?.markdown ?? "", pinned: draft, updatedAt: new Date().toISOString() }));
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }, [draft]);

  // A **bold** name in the memory has no per-message entity index behind it,
  // so it resolves the way the chat's soft links do: through search.
  const lookup = (name: string) => void lookupName(name).then((id) => id && onSelectNode(id));

  const body = [memory?.markdown ?? "", memory?.pinned?.trim() ? `## Notes\n${memory.pinned}` : ""].filter(Boolean).join("\n");

  return (
    <section className="flex flex-col gap-[16px]" aria-label="What I know about you">
      <div className="flex flex-wrap items-baseline gap-[12px]">
        <h1 className="t-title">what I know about you</h1>
        {memory?.updatedAt && <span className="t-meta whitespace-nowrap">rewritten {terseTime(memory.updatedAt)}</span>}
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(memory?.pinned ?? "");
              setEditing(true);
            }}
            className="t-link ml-auto shrink-0"
          >
            edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex max-w-[880px] flex-col gap-[12px]">
          <p className="t-prose">in your words. these lines are kept exactly as you write them.</p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            aria-label="in your words"
            className="t-note w-full resize-y border-b border-[color:var(--line-note)] bg-transparent pb-[8px] outline-none placeholder:text-ink-ghost"
            placeholder="I will watch anything shot on film."
          />
          <div className="flex items-center gap-[16px]">
            <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-outline disabled:opacity-40">
              {saving ? "saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="t-link">
              cancel
            </button>
          </div>
        </div>
      ) : body ? (
        <MemoryProse markdown={body} onLookup={lookup} />
      ) : (
        <p className="t-prose">nothing yet. log a few things below, or tell the chat what you love.</p>
      )}
    </section>
  );
}

// ---- recently logged -------------------------------------------------------

const LIMIT = 10;

function RecentlyLogged({
  onSelectNode,
  version,
  onWholeLog,
}: {
  onSelectNode: (imdbId: string) => void;
  version: number;
  onWholeLog: () => void;
}) {
  const [rows, setRows] = useState<WatchedRow[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/taste/watched", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { watched: WatchedRow[] }).watched : []))
      .then((w) => {
        if (!alive) return;
        setTotal(w.length);
        setRows([...w].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, LIMIT));
      })
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [version]);

  const ids = (rows ?? []).map((r) => r.titleImdbId);
  const images = useImages(ids);
  const names = useNames(ids);
  // The kind, the runtime and the episode count live in Numbers' own GET,
  // which this page makes anyway — so the mono column borrows it rather than
  // asking a second route for the same three facts.
  const numbers = useNumbers(version);
  const meta = new Map(
    numbers.status === "ready" ? numbers.data.log.map((r) => [r.imdbId, r] as const) : [],
  );

  return (
    <section className="flex flex-col gap-[12px]" aria-label="Recently logged">
      <div className="section-head">
        <h2 className="t-title">recently logged</h2>
        {total > 0 && (
          <span className="t-meta">
            {Math.min(LIMIT, total)} of {total}
          </span>
        )}
        <button type="button" onClick={onWholeLog} className="t-link ml-auto shrink-0">
          the whole log
        </button>
      </div>

      {rows === null && <p className="t-meta">reading the log…</p>}
      {rows !== null && rows.length === 0 && <p className="t-prose">nothing logged yet. type a title below.</p>}

      <div className="flex flex-col">
        {(rows ?? []).map((row) => {
          const id = row.titleImdbId;
          const m = meta.get(id);
          const kind = m ? (m.kind === "series" ? "show" : "film") : "";
          const tail = m ? [kind, m.kind === "series" ? null : m.runtime ? `${m.runtime}m` : null].filter(Boolean).join(" · ") : "";
          const year = names[id]?.year || m?.year || "";
          return (
            <button
              key={`${id}-${row.season ?? 0}`}
              type="button"
              onClick={() => onSelectNode(id)}
              className="row h-[52px] grid-cols-[26px_minmax(0,1fr)] text-left sm:h-[38px] sm:grid-cols-[88px_26px_minmax(0,320px)_48px_64px_minmax(0,1fr)]"
            >
              <span className="t-meta hidden sm:block">{terseTime(row.updatedAt)}</span>
              {images[id]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[id]!.url!} alt="" className="poster-mark" loading="lazy" />
              ) : (
                <span className="poster-mark" />
              )}
              <span className="min-w-0">
                <span className="t-row block truncate">
                  {names[id]?.name ?? m?.name ?? "…"}
                  {row.season ? <span className="t-meta ml-[6px] text-ink-faint">s{row.season}</span> : null}
                  {/* the phone row is two lines: poster + title + year, then the mono meta */}
                  {year ? <span className="t-meta ml-[6px] text-ink-faint sm:hidden">{year}</span> : null}
                </span>
                <span className="t-meta block sm:hidden">
                  {[terseTime(row.updatedAt), row.rating, tail].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="t-meta hidden text-ink-faint sm:block">{year}</span>
              <span className={`bucket hidden sm:block ${row.rating === "liked" ? "bucket-on" : ""}`}>{row.rating}</span>
              <span className="t-meta hidden truncate sm:block">{tail}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
