"use client";
/**
 * You — the receipt (SPEC v5 → You page). Five things and nothing else:
 * the memory prose with `edit` and `rewritten Nm ago`, one sentence of
 * numbers, the people row, the decades ledger, and Later.
 *
 * Everything that was plumbing — services, imports, the swipe button — moved
 * to `/settings`; tonight moved into Ask's empty state; recently logged and
 * the charts are the Log page's job. This page is about you, not about the
 * machine (story 79).
 *
 * Board C grammar throughout: sections separate by air and one hairline under
 * each header, rows carry no rule between them, figures are mono, and there is
 * no accent anywhere on this screen.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { lookupName } from "@/components/chat/lookup";
import { useImages } from "@/components/chat/useImages";
import { useNames } from "@/components/chat/useNames";
import { useSessionUser, signInHref } from "@/components/auth/SignInGate";
import { MemoryProse } from "./MemoryProse";
import { barClass, barRank, barWidth, rowInk } from "./ledger";
import { bumpLog, useLogVersion } from "./logBus";
import { droppedParts } from "./memoryDropped";
import { numbersSentence } from "./numbersRules";
import { terseTime } from "./recent";
import { useNumbers, type PersonWithFace } from "./useNumbers";
import { decadeRows, laterRows, peopleRow } from "./youRows";
import type { WatchedRow } from "@/lib/taste/types";

interface Props {
  /** Open a person or title in the drawer. */
  onSelectNode: (imdbId: string) => void;
  /** Go to the Log, optionally filtered — Later's "the whole list". */
  onGoToLog?: (filter?: "want") => void;
}

export function YouPage({ onSelectNode, onGoToLog }: Props) {
  const { user, loading } = useSessionUser();
  const version = useLogVersion();

  if (loading) return <p className="t-meta">…</p>;

  if (!user) {
    return (
      <section className="flex max-w-[560px] flex-col items-start gap-[22px]" aria-label="You">
        <p className="text-[26px] font-semibold leading-[1.25] tracking-[-0.02em] text-ink">
          I keep the log of everything you have watched, and I know what it says about you.
        </p>
        <p className="t-meta">no password, ever. the chat works without an account.</p>
        <Link href={signInHref("/")} className="btn btn-outline">
          Sign in
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-[28px] sm:gap-[38px]" aria-label="You">
      <Memory onSelectNode={onSelectNode} version={version} />
      <NumbersLine onSelectNode={onSelectNode} version={version} />
      <Later onSelectNode={onSelectNode} version={version} onGoToLog={onGoToLog} />
    </div>
  );
}

// ---- what I know about you -------------------------------------------------

interface MemoryRow {
  markdown: string;
  pinned: string;
  /** Null until the rewrite job has written once. */
  updatedAt: string | null;
  /** Titles the last rewrite took out of the prose because the log no longer has them. */
  dropped?: string[];
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
  /** The "no longer in your log" line is said once and then dismissed for good. */
  const [dismissed, setDismissed] = useState(false);

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

  /**
   * A rewrite that dropped titles says so once, under the header, and `ok`
   * clears `dropped` server-side so it never comes back for the same removal.
   */
  const dropped = dismissed ? [] : (memory?.dropped ?? []);
  const dismissDropped = useCallback(() => {
    setDismissed(true);
    void fetch("/api/taste/memory", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dismissDropped: true }),
    }).catch(() => {});
  }, []);

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
            className="tap ml-auto shrink-0"
          >
            <span className="t-link">edit</span>
          </button>
        )}
      </div>

      {droppedParts(dropped).length > 0 && (
        <p className="t-meta flex flex-wrap items-center gap-[10px]">
          <span>
            {droppedParts(dropped).map((part, i) => (
              <span key={i} className={part.bold ? "text-ink" : undefined}>
                {part.text}
              </span>
            ))}
          </span>
          <button type="button" onClick={dismissDropped} className="tap">
            <span className="t-link">ok</span>
          </button>
        </p>
      )}

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
            <button type="button" onClick={() => setEditing(false)} className="tap">
              <span className="t-link">cancel</span>
            </button>
          </div>
        </div>
      ) : body ? (
        <MemoryProse markdown={body} onLookup={lookup} />
      ) : (
        <p className="t-prose">nothing yet. log a few things, or tell the chat what you love.</p>
      )}
    </section>
  );
}

// ---- numbers: one sentence, one people row, one decades ledger -------------

/**
 * What was a page of charts is one line of prose and two rows (SPEC v5). The
 * counting still happens server-side in `/api/taste/numbers`; this draws.
 */
function NumbersLine({ onSelectNode, version }: { onSelectNode: (imdbId: string) => void; version: number }) {
  const state = useNumbers(version);

  return (
    <section className="flex flex-col gap-[16px]" aria-label="Numbers">
      <div className="section-head">
        <h2 className="t-title">numbers</h2>
        <span className="t-sub hidden sm:inline">everything Letterboxd never gave you</span>
      </div>

      {state.status === "loading" && <p className="t-meta">counting…</p>}
      {state.status === "error" && <p className="t-prose">numbers are not answering right now.</p>}
      {state.status === "signed-out" && <p className="t-prose">sign in to see your numbers.</p>}
      {state.status === "ready" && (
        <>
          <p className="t-prose max-w-[880px]">{numbersSentence(state.data.totals, state.data.decades)}</p>
          <PeopleRow people={peopleRow(state.data.people)} onSelectNode={onSelectNode} />
          <DecadeLedger decades={decadeRows(state.data.decades)} />
        </>
      )}
    </section>
  );
}

/**
 * Who you keep watching: one row of twelve faces, name and count under each.
 * No bars — the faces are the ranking, and a bar under a face would be the
 * second ranking of the same fact. It scrolls sideways rather than wrapping
 * into a wall (DESIGN.md → Rhythm: nothing but a table scrolls horizontally,
 * and this row scrolls inside its own container, like one).
 */
function PeopleRow({ people, onSelectNode }: { people: PersonWithFace[]; onSelectNode: (imdbId: string) => void }) {
  if (people.length === 0) return null;
  return (
    <div className="flex flex-col gap-[10px]">
      <span className="t-sub">who you keep watching</span>
      <div className="scrollbar-thin -mx-4 flex gap-[18px] overflow-x-auto px-4 pb-[4px] md:-mx-[12px] md:px-[12px]">
        {people.map((p) => (
          <button key={p.imdbId} type="button" onClick={() => onSelectNode(p.imdbId)} className="group flex w-[52px] shrink-0 flex-col gap-[6px] text-left">
            {p.face ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.face} alt="" className="h-[52px] w-[52px] bg-raised object-cover" loading="lazy" />
            ) : (
              <span className="block h-[52px] w-[52px] bg-raised" />
            )}
            <span className="truncate text-[12.5px] leading-[1.25] text-ink-dim transition-colors duration-[120ms] group-hover:text-ink" title={p.name}>
              {p.name}
            </span>
            <span className="tnum text-[11.5px] leading-none text-ink-ghost">{p.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** By decade: the ledger form, six rows, mono labels because a decade is a figure. */
function DecadeLedger({ decades }: { decades: { decade: string; count: number }[] }) {
  if (decades.length === 0) return null;
  const peak = Math.max(...decades.map((d) => d.count), 1);
  return (
    <div className="flex flex-col gap-[7px]">
      <span className="t-sub">by decade</span>
      {decades.map((d, i) => (
        <div key={d.decade} className="row row-fig grid-cols-[88px_44px_minmax(0,1fr)] sm:grid-cols-[108px_52px_minmax(0,1fr)]">
          <span className={`tnum truncate text-[13.5px] ${rowInk(i, decades.length)}`}>{d.decade}</span>
          <span className={`tnum text-[13.5px] leading-[1.2] ${rowInk(i, decades.length)}`}>{d.count.toLocaleString()}</span>
          <span className={barClass(barRank(i, decades.length))} style={{ width: barWidth(d.count, peak) }} />
        </div>
      ))}
    </div>
  );
}

// ---- later -----------------------------------------------------------------

/**
 * Later is the `want` rows, newest first, in the 38px log row form: poster
 * mark, title, year. One quiet control per row — `seen it` writes the state
 * through the same `POST /api/taste/log` every other write goes through — and
 * the header links to the Log filtered to `want`, which is the same list with
 * everything else the table can say about it.
 */
function Later({
  onSelectNode,
  version,
  onGoToLog,
}: {
  onSelectNode: (imdbId: string) => void;
  version: number;
  onGoToLog?: (filter?: "want") => void;
}) {
  const [rows, setRows] = useState<WatchedRow[] | null>(null);
  const [gone, setGone] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let alive = true;
    fetch("/api/taste/watched", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { watched: WatchedRow[] }).watched : []))
      .then((w) => alive && setRows(laterRows(w)))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [version]);

  const kept = (rows ?? []).filter((r) => !gone.has(r.titleImdbId));
  const ids = kept.map((r) => r.titleImdbId);
  const images = useImages(ids);
  const names = useNames(ids);

  const seenIt = (imdbId: string) => {
    setGone((g) => new Set(g).add(imdbId));
    void fetch("/api/taste/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imdbId, state: "seen" }),
    })
      .then(() => bumpLog())
      .catch(() => {});
  };

  return (
    <section className="flex flex-col gap-[12px]" aria-label="Later">
      <div className="section-head">
        <h2 className="t-title">later</h2>
        {kept.length > 0 && <span className="t-meta">{kept.length} saved</span>}
        {onGoToLog && (
          <button type="button" onClick={() => onGoToLog("want")} className="tap ml-auto shrink-0">
            <span className="t-link">the whole list</span>
          </button>
        )}
      </div>

      {rows === null && <p className="t-meta">reading later…</p>}
      {rows !== null && kept.length === 0 && <p className="t-prose">nothing saved. log something as want and it lands here.</p>}

      <div className="flex flex-col">
        {kept.map((row) => {
          const id = row.titleImdbId;
          const year = names[id]?.year ?? "";
          return (
            <div key={id} className="row grid-cols-[26px_minmax(0,1fr)_auto] sm:grid-cols-[26px_minmax(0,360px)_48px_minmax(0,1fr)]">
              <button type="button" onClick={() => onSelectNode(id)} aria-label={names[id]?.name ?? id}>
                {images[id]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[id]!.url!} alt="" className="poster-mark" loading="lazy" />
                ) : (
                  <span className="poster-mark" />
                )}
              </button>
              {/* Phone: two lines in a 52px row — the title, then the year as
                  mono under it, so a long title never squeezes the year down to
                  an ellipsis (DESIGN.md → Rhythm → Phone). */}
              <button type="button" onClick={() => onSelectNode(id)} className="flex min-w-0 flex-col gap-[2px] text-left sm:block">
                <span className="t-row block truncate">{names[id]?.name ?? "…"}</span>
                {year ? <span className="t-meta block text-ink-faint sm:hidden">{year}</span> : null}
              </button>
              <span className="t-meta hidden text-ink-faint sm:block">{year}</span>
              <button type="button" onClick={() => seenIt(id)} className="tap justify-self-end sm:justify-self-start">
                <span className="t-link">seen it</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
