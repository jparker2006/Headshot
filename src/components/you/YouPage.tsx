"use client";
/**
 * You — what I know about you (SPEC v5.3 → "Memory you can read"). One column,
 * 720px, in one reading order:
 *
 *   1. the sentence — who you are, in one line, no names and no numbers
 *   2. the claims — one belief per row, with the titles that prove it
 *   3. right now, then later — both straight out of the log
 *   4. in your words — your pinned lines and your newest notes
 *
 * v5.2's essay is gone, and with it the two-column flow, the people row and
 * the decades ledger: a claim with five posters under it says the same thing
 * and says where it came from. The numbers stay as the one sentence they were.
 *
 * Board C grammar throughout: sections separate by air and one hairline under
 * each header, rows carry no rule between them, figures are mono, and there is
 * no accent anywhere on this screen.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useImages } from "@/components/chat/useImages";
import { useNames } from "@/components/chat/useNames";
import { useSessionUser, signInHref } from "@/components/auth/SignInGate";
import { formatScore } from "@/components/log/scoreRules";
import type { LogFilter } from "./numbersRules";
import { claimInk, claimTag, orderEvidence, truncateClaim, visibleClaims, type Claim, type MemoryClaims } from "./claimRows";
import { bumpLog, useLogVersion } from "./logBus";
import { droppedParts } from "./memoryDropped";
import { numbersSentence } from "./numbersRules";
import { terseTime } from "./recent";
import { useNumbers } from "./useNumbers";
import { laterRows, rightNowRows } from "./youRows";
import type { WatchedRow } from "@/lib/taste/types";

interface Props {
  /** Open a person or title in the drawer. */
  onSelectNode: (imdbId: string) => void;
  /** Go to the Log, optionally filtered — Later's "the whole list", notes' "all notes". */
  onGoToLog?: (filter?: LogFilter) => void;
}

/** How many notes "in your words" quotes back before it sends you to the Log. */
const NOTES_SHOWN = 6;

export function YouPage({ onSelectNode, onGoToLog }: Props) {
  const { user, loading } = useSessionUser();
  const version = useLogVersion();
  const numbers = useNumbers(version);
  const [watched, setWatched] = useState<WatchedRow[] | null>(null);
  const [memory, setMemory] = useState<MemoryRow | null>(null);

  // One read of the memory for the whole page: the claims open it and "in your
  // words" closes it, and they are one row.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch("/api/taste/memory", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as MemoryRow) : null))
      .then((m) => alive && m && setMemory(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [version, user]);

  // One read of the rows for both lists below: right now and later are two
  // cuts of the same log, and two fetches of it would be two.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch("/api/taste/watched", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { watched: WatchedRow[] }).watched : []))
      .then((w) => alive && setWatched(w))
      .catch(() => alive && setWatched([]));
    return () => {
      alive = false;
    };
  }, [version, user]);

  const log = useMemo(() => (numbers.status === "ready" ? numbers.data.log : []), [numbers]);
  /** Every score the log knows, by id — what orders a claim's evidence. */
  const scores = useMemo(() => Object.fromEntries(log.map((r) => [r.imdbId, r.score])), [log]);

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
    <div className="flex max-w-[720px] flex-col gap-[28px] sm:gap-[38px]" aria-label="You">
      <Memory
        memory={memory}
        setMemory={setMemory}
        scores={scores}
        numbersLine={numbers.status === "ready" ? numbersSentence(numbers.data.totals, numbers.data.decades) : null}
        onSelectNode={onSelectNode}
      />
      <RightNow rows={watched} onSelectNode={onSelectNode} />
      <Later rows={watched} onSelectNode={onSelectNode} onGoToLog={onGoToLog} />
      <InYourWords
        pinned={memory?.pinned ?? ""}
        notes={log.filter((r) => (r.note ?? "").trim() !== "").slice(0, NOTES_SHOWN)}
        onSelectNode={onSelectNode}
        onGoToLog={onGoToLog}
      />
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
  /** SPEC v5.3. Null for a memory written before the migration — `markdown` is the fallback. */
  claims?: MemoryClaims | null;
}

/**
 * The page's opening, so its header carries no rule — it needs no seam
 * (DESIGN.md → You → Memory). `edit` writes the pinned block, which the
 * rewrite job copies through verbatim.
 */
function Memory({
  memory,
  setMemory,
  scores,
  numbersLine,
  onSelectNode,
}: {
  memory: MemoryRow | null;
  setMemory: React.Dispatch<React.SetStateAction<MemoryRow | null>>;
  scores: Record<string, number | null>;
  numbersLine: string | null;
  onSelectNode: (imdbId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  /** The "no longer in your log" line is said once and then dismissed for good. */
  const [dismissed, setDismissed] = useState(false);
  /** Claims the user has just said "not me" to: gone from the page before the PUT lands. */
  const [rejected, setRejected] = useState<Set<string>>(() => new Set());

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/taste/memory", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pinned: draft }),
      });
      if (r.ok) {
        setMemory((m) => ({ ...(m ?? { markdown: "", dropped: [], claims: null }), pinned: draft, updatedAt: new Date().toISOString() }));
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }, [draft, setMemory]);

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

  /** "not me": the row goes now, the rewrite makes it permanent. */
  const reject = useCallback((id: string) => {
    setRejected((r) => new Set(r).add(id));
    void fetch("/api/taste/memory", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rejectClaim: id }),
    }).catch(() => {});
  }, []);

  const claims = visibleClaims(memory?.claims?.claims, rejected);
  const sentence = memory?.claims?.sentence?.trim() ?? "";

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
        <div className="flex flex-col gap-[12px]">
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
      ) : (
        <>
          <Sentence sentence={sentence} markdown={memory?.markdown ?? ""} hasClaims={claims.length > 0} />
          {claims.length > 0 && (
            <div className="flex flex-col gap-[12px]">
              {claims.map((claim) => (
                <ClaimRow key={claim.id} claim={claim} scores={scores} onSelectNode={onSelectNode} onReject={reject} />
              ))}
            </div>
          )}
          {numbersLine && <p className="t-prose">{numbersLine}</p>}
        </>
      )}
    </section>
  );
}

/**
 * The one line that says who you are. When the rewrite has not produced claims
 * yet, the old markdown stands in as plain prose — stripped of its headings and
 * its bold, because this line is not a place for a name or a number.
 */
function Sentence({ sentence, markdown, hasClaims }: { sentence: string; markdown: string; hasClaims: boolean }) {
  if (sentence) return <p className="text-[17px] font-normal leading-[1.5] text-ink">{sentence}</p>;

  const fallback = markdown
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.replace(/^[-*]\s+/, "").replace(/\*\*/g, ""));

  if (fallback.length > 0) {
    return (
      <div className="flex flex-col gap-[8px]">
        {fallback.map((line, i) => (
          <p key={i} className="t-prose">
            {line}
          </p>
        ))}
      </div>
    );
  }
  if (hasClaims) return null;
  return <p className="t-prose">nothing yet. log a few things, or tell the chat what you love.</p>;
}

/**
 * One belief and its proof. The text reads first; the marks under it are the
 * rows it came from, best score first, and every one of them opens. `not me`
 * waits until the row is wanted — except on a touch screen, which never hovers.
 */
function ClaimRow({
  claim,
  scores,
  onSelectNode,
  onReject,
}: {
  claim: Claim;
  scores: Record<string, number | null>;
  onSelectNode: (imdbId: string) => void;
  onReject: (id: string) => void;
}) {
  const ids = useMemo(() => orderEvidence(claim.evidence, scores), [claim.evidence, scores]);
  const images = useImages(ids);
  const names = useNames(ids);
  const tag = claimTag(claim.polarity);

  return (
    <div className="claim-row flex flex-col gap-[10px] sm:flex-row sm:items-start sm:gap-[18px]">
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-[10px]">
        <span className={`text-[14.5px] leading-[1.4] ${claimInk(claim.polarity)}`}>{truncateClaim(claim.text)}</span>
        {tag && <span className="t-meta">{tag}</span>}
      </div>

      <div className="flex shrink-0 flex-wrap items-start gap-[10px]">
        {ids.map((id) => {
          const score = scores[id];
          const face = id.startsWith("nm");
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectNode(id)}
              aria-label={names[id]?.name ?? id}
              title={names[id]?.name ?? id}
              className="flex w-[30px] flex-col items-center gap-[4px]"
            >
              {images[id]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[id]!.url!} alt="" className={`poster-mark ${face ? "poster-mark-face" : "poster-mark-md"}`} loading="lazy" />
              ) : (
                <span className={`poster-mark ${face ? "poster-mark-face" : "poster-mark-md"}`} />
              )}
              <span className="tnum text-[11.5px] leading-none text-ink-ghost">{score != null ? formatScore(score) : ""}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => onReject(claim.id)} className="tap row-reveal self-center">
          <span className="t-link">not me</span>
        </button>
      </div>
    </div>
  );
}

// ---- right now -------------------------------------------------------------

/**
 * The series you are part-way through, straight from the rows (story 89): the
 * season you marked and the episodes counted against it. No section at all
 * when nothing is running — an empty header is a question nobody asked.
 */
function RightNow({ rows, onSelectNode }: { rows: WatchedRow[] | null; onSelectNode: (imdbId: string) => void }) {
  const kept = useMemo(() => rightNowRows(rows ?? []), [rows]);
  const ids = kept.map((r) => r.titleImdbId);
  const images = useImages(ids);
  const names = useNames(ids);
  if (kept.length === 0) return null;

  return (
    <section className="flex flex-col gap-[12px]" aria-label="Right now">
      <div className="section-head">
        <h2 className="t-title">right now</h2>
      </div>
      <div className="flex flex-col">
        {kept.map((row) => {
          const id = row.titleImdbId;
          const meta = [`s${row.season}`, row.episodesWatched > 0 ? `${row.episodesWatched} eps` : ""].filter(Boolean).join(" · ");
          return (
            <div key={id} className="row grid-cols-[26px_minmax(0,1fr)_auto]">
              <button type="button" onClick={() => onSelectNode(id)} aria-label={names[id]?.name ?? id}>
                {images[id]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[id]!.url!} alt="" className="poster-mark" loading="lazy" />
                ) : (
                  <span className="poster-mark" />
                )}
              </button>
              <button type="button" onClick={() => onSelectNode(id)} className="flex min-w-0 flex-col gap-[2px] text-left sm:block">
                <span className="t-row block truncate">{names[id]?.name ?? "…"}</span>
                <span className="t-meta block sm:hidden">{meta}</span>
              </button>
              <span className="t-meta hidden justify-self-end sm:block">{meta}</span>
            </div>
          );
        })}
      </div>
    </section>
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
  rows,
  onSelectNode,
  onGoToLog,
}: {
  rows: WatchedRow[] | null;
  onSelectNode: (imdbId: string) => void;
  onGoToLog?: (filter?: LogFilter) => void;
}) {
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const kept = useMemo(() => laterRows(rows ?? []).filter((r) => !gone.has(r.titleImdbId)), [rows, gone]);
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

// ---- in your words ---------------------------------------------------------

/**
 * Your lines, not mine: the pinned block first, because you wrote it on
 * purpose, then the newest notes off the log, each quoted with the title it
 * belongs to under it. `all notes` is the Log on its `noted` chip.
 */
function InYourWords({
  pinned,
  notes,
  onSelectNode,
  onGoToLog,
}: {
  pinned: string;
  notes: { imdbId: string; name: string; note: string | null }[];
  onSelectNode: (imdbId: string) => void;
  onGoToLog?: (filter?: LogFilter) => void;
}) {
  const lines = pinned
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0 && notes.length === 0) return null;

  return (
    <section className="flex flex-col gap-[14px]" aria-label="In your words">
      <div className="section-head">
        <h2 className="t-title">in your words</h2>
        {onGoToLog && notes.length > 0 && (
          <button type="button" onClick={() => onGoToLog("noted")} className="tap ml-auto shrink-0">
            <span className="t-link">all notes</span>
          </button>
        )}
      </div>

      {lines.map((line, i) => (
        <p key={`pinned-${i}`} className="t-note">
          {line}
        </p>
      ))}

      {notes.map((row) => (
        <button key={row.imdbId} type="button" onClick={() => onSelectNode(row.imdbId)} className="flex flex-col items-start gap-[3px] text-left">
          <span className="t-note">{row.note}</span>
          <span className="t-meta">{row.name}</span>
        </button>
      ))}
    </section>
  );
}
