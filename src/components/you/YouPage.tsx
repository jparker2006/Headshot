"use client";
/**
 * You — home. The log with a brain, in the order SPEC v4 fixed: log field,
 * what I know about you, recently logged, tonight, numbers, services, imports,
 * later, the swipe button.
 *
 * This is chunk A's structure, not its final look: headings are plain
 * sentences and nothing is boxed, so chunk C can restyle from the winning
 * board without unpicking a card layout first.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Markdown } from "@/components/chat/Markdown";
import { lookupName } from "@/components/chat/lookup";
import { useImages } from "@/components/chat/useImages";
import { useNames } from "@/components/chat/useNames";
import { useSessionUser, signInHref } from "@/components/auth/SignInGate";
import { LaterPanel } from "@/components/tonight/LaterPanel";
import { ReasonLine, useTonight } from "@/components/tonight/TonightPanel";
import { Numbers } from "./Numbers";
import { LogField } from "./LogField";
import { ServicesChecklist } from "./ServicesChecklist";
import { LetterboxdImport } from "./LetterboxdImport";
import { BUCKET_LABEL, recentlyLogged, relativeTime } from "./recent";
import type { WatchedRow } from "@/lib/taste/types";

interface Props {
  /** Open a person or title in the drawer. */
  onSelectNode: (imdbId: string) => void;
  /** Put a question to the agent; the shell opens a thread with it. */
  onAsk: (text: string) => void;
}

export function YouPage({ onSelectNode, onAsk }: Props) {
  const { user, loading } = useSessionUser();
  const [logged, setLogged] = useState(0);

  if (loading) return <p className="text-[13.5px] text-ink-faint">…</p>;
  if (!user) {
    return (
      <section className="space-y-4" aria-label="You">
        <p className="max-w-[46ch] text-[19px] leading-[1.4] tracking-[-0.01em] text-ink">
          Headshot keeps the log of everything you&apos;ve watched and learns your taste from it.
        </p>
        <Link href={signInHref("/")} className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[12.5px] font-semibold text-black">
          Sign in
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-12" aria-label="You">
      <LogField onLogged={() => setLogged((n) => n + 1)} />
      <MemorySection onSelectNode={onSelectNode} refreshKey={logged} />
      <RecentlyLogged onSelectNode={onSelectNode} refreshKey={logged} />
      <TonightRow onSelectNode={onSelectNode} />

      <Section title="Numbers">
        <Numbers onSelectNode={onSelectNode} />
      </Section>

      <Section title="Services">
        <p className="text-[14px] text-ink-dim">What you pay for. Tonight only picks things you can open.</p>
        <ServicesChecklist />
      </Section>

      <Section title="Imports">
        <LetterboxdImport />
        <p className="text-[13.5px] text-ink-faint">Netflix viewing activity — coming in the next chunk.</p>
        <p className="text-[13.5px] text-ink-faint">IMDb ratings — coming in the next chunk.</p>
      </Section>

      <LaterPanel onSelectNode={onSelectNode} />

      <div className="space-y-2">
        <Link href="/onboarding" className="inline-flex h-9 items-center rounded-full border border-line px-4 text-[13px] text-ink hover:border-line-strong">
          Swipe through your back-catalog
        </Link>
        <p className="text-[13px] text-ink-faint">
          Or just{" "}
          <button type="button" onClick={() => onAsk("what should I watch tonight?")} className="text-accent">
            ask
          </button>
          .
        </p>
      </div>
    </div>
  );
}

/** A plain sentence heading and its block. No box, no rule, no label. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

// ---- what I know about you -------------------------------------------------

interface Memory {
  markdown: string;
  pinned: string;
  /** Null until the rewrite job has written once. */
  updatedAt: string | null;
}

function MemorySection({ onSelectNode, refreshKey }: { onSelectNode: (imdbId: string) => void; refreshKey: number }) {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/taste/memory", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as Memory) : null))
      .then((m) => alive && m && setMemory(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [refreshKey]);

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
  // so it resolves the same way the chat's soft links do: through search.
  const lookup = (name: string) => void lookupName(name).then((id) => id && onSelectNode(id));

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">What I know about you</h2>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(memory?.pinned ?? "");
              setEditing(true);
            }}
            className="text-[13px] text-ink-faint hover:text-ink"
          >
            Edit
          </button>
        )}
      </div>

      {memory?.markdown ? (
        <Markdown text={memory.markdown} onSelectNode={onSelectNode} onLookup={lookup} />
      ) : (
        <p className="text-[14px] text-ink-dim">Nothing yet. Log a few things, or tell the chat what you love.</p>
      )}

      {editing ? (
        <div className="space-y-2">
          <p className="text-[13px] text-ink-dim">In your words. These lines are kept exactly as you write them.</p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            aria-label="in your words"
            className="w-full resize-y rounded-panel bg-raised px-3 py-2 text-[14px] text-ink outline-none ring-1 ring-line placeholder:text-ink-faint focus:ring-line-strong"
            placeholder="I will watch anything shot on film."
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="h-9 rounded-full bg-accent px-4 text-[12.5px] font-semibold text-black disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-[13px] text-ink-faint hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        memory?.pinned?.trim() && (
          <div className="space-y-1">
            <p className="text-[13px] text-ink-faint">In your words</p>
            <Markdown text={memory.pinned} onSelectNode={onSelectNode} onLookup={lookup} />
          </div>
        )
      )}

      {memory?.updatedAt && !editing && <p className="text-[12.5px] text-ink-faint">updated {relativeTime(memory.updatedAt)}</p>}
    </section>
  );
}

// ---- recently logged -------------------------------------------------------

function RecentlyLogged({ onSelectNode, refreshKey }: { onSelectNode: (imdbId: string) => void; refreshKey: number }) {
  const [rows, setRows] = useState<WatchedRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/taste/watched", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { watched: WatchedRow[] }).watched : []))
      .then((w) => alive && setRows(recentlyLogged(w, 10)))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const ids = (rows ?? []).map((r) => r.titleImdbId);
  const images = useImages(ids);
  const names = useNames(ids);

  return (
    <Section title="Recently logged">
      {rows === null && <p className="text-[13.5px] text-ink-faint">reading the log…</p>}
      {rows !== null && rows.length === 0 && <p className="text-[14px] text-ink-dim">Nothing logged yet. The field at the top takes ten seconds.</p>}
      {rows !== null && rows.length > 0 && (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.titleImdbId} className="flex items-center gap-4 py-3">
              <button
                onClick={() => onSelectNode(row.titleImdbId)}
                className="h-14 w-10 shrink-0 overflow-hidden rounded bg-white/[0.05] ring-1 ring-line hover:ring-accent/60"
                aria-label={names[row.titleImdbId]?.name ?? row.titleImdbId}
              >
                {images[row.titleImdbId]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[row.titleImdbId]!.url!} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </button>
              <button onClick={() => onSelectNode(row.titleImdbId)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[15px] font-medium text-ink">{names[row.titleImdbId]?.name ?? "…"}</span>
                <span className="text-[12.5px] text-ink-faint">
                  {names[row.titleImdbId]?.year || ""}
                  {names[row.titleImdbId]?.year ? " · " : ""}
                  {BUCKET_LABEL[row.rating] ?? row.rating}
                  {row.season ? ` · s${row.season}` : ""}
                </span>
              </button>
              <span className="shrink-0 text-[12.5px] text-ink-faint">{relativeTime(row.updatedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---- tonight ---------------------------------------------------------------

function TonightRow({ onSelectNode }: { onSelectNode: (imdbId: string) => void }) {
  const [state, refresh] = useTonight();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const regenerate = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/tonight/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    } catch {
      /* the refresh link is best effort; the state below says what happened */
    } finally {
      setRefreshing(false);
      refresh();
    }
  };

  const empty = (
    <p className="text-[14px] text-ink-dim">
      Rate a few things and this fills in tonight.{" "}
      <button type="button" onClick={() => void regenerate()} disabled={refreshing} className="text-accent disabled:opacity-40">
        {refreshing ? "looking…" : "look now"}
      </button>
    </p>
  );

  return (
    <Section title="Tonight">
      {state.status === "loading" && <p className="text-[13.5px] text-ink-faint">finding one for tonight…</p>}
      {(state.status === "empty" || state.status === "signed-out" || state.status === "error") && empty}
      {state.status === "ready" && state.data.picks.length === 0 && empty}
      {state.status === "ready" && state.data.picks.length > 0 && (
        <>
          <div className="divide-y divide-line">
            {(open ? state.data.picks : state.data.picks.slice(0, 1)).map((pick) => (
              <div key={pick.imdbId} className="flex flex-wrap items-center gap-x-5 gap-y-3 py-3">
                <button
                  type="button"
                  onClick={() => onSelectNode(pick.imdbId)}
                  className="h-16 w-12 shrink-0 overflow-hidden rounded bg-white/[0.05] ring-1 ring-line hover:ring-accent/60"
                  aria-label={pick.name}
                >
                  {pick.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pick.posterUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </button>
                <p className="min-w-[200px] flex-1 text-[16px] leading-[1.35] text-ink-dim">
                  <button type="button" onClick={() => onSelectNode(pick.imdbId)} className="font-semibold text-ink underline-offset-4 decoration-accent/60 hover:underline">
                    {pick.name}
                  </button>
                  {pick.kind === "continue" ? ", " : ". "}
                  <ReasonLine text={pick.reason.text} onSelectNode={onSelectNode} />
                </p>
                {pick.playUrl && pick.playLabel ? (
                  <a href={pick.playUrl} target="_blank" rel="noopener" className="flex h-9 shrink-0 items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-black">
                    {pick.playLabel}
                  </a>
                ) : (
                  <span className="text-[12.5px] text-ink-faint">not streaming</span>
                )}
              </div>
            ))}
          </div>
          {state.data.picks.length > 1 && (
            <button type="button" onClick={() => setOpen((o) => !o)} className="text-[13px] text-ink-faint hover:text-ink">
              {open ? "just the first one" : `show all ${state.data.picks.length}`}
            </button>
          )}
        </>
      )}
    </Section>
  );
}
