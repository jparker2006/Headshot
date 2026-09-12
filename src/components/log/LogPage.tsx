"use client";
/**
 * Log — the product, and the landing for a signed-in user (SPEC v5 → Log
 * page; `design/boards-v5/Log.dc.html`, `Log-phone.dc.html`).
 *
 * Top: one field, "what did you watch?", resolving against the graph through
 * `POST /api/taste/log` `{ query }`. Pick a title and the field's answer
 * becomes the thing you are rating: the row of ten (keys 1–0, 0 is ten), the
 * two states a person says out loud (`want`, `seen`), a season for a show,
 * and one optional line stored word for word. Ten seconds, no dialog.
 *
 * Below: the whole log, newest first. Both halves read the same store — the
 * write bumps `logBus` and the table re-fetches — so a row appears at the top
 * of the table the moment it is logged.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useImages } from "@/components/chat/useImages";
import { bumpLog, useLogVersion } from "@/components/you/logBus";
import { useNumbers } from "@/components/you/useNumbers";
import type { WatchedRow } from "@/lib/taste/types";
import { CatchUp } from "@/components/you/CatchUp";
import { LogTable } from "./LogTable";
import { ScoreRow } from "./ScoreRow";

/** What `POST /api/taste/log` `{ query }` hands back for one match. */
export interface LogCandidate {
  imdbId: string;
  name: string;
  year: number | null;
  kind: "movie" | "series";
  seasons: { season: number; episodes: number }[] | null;
}

interface Props {
  /** Open a person or title in the drawer. */
  onSelectNode: (imdbId: string) => void;
}

type PickedState = "want" | "seen";

export function LogPage({ onSelectNode }: Props) {
  const version = useLogVersion();
  const numbers = useNumbers(version);
  const [catchUp, setCatchUp] = useState(false);

  const rows = numbers.status === "ready" ? numbers.data.log : [];
  const totals = numbers.status === "ready" ? numbers.data.totals : null;

  return (
    <div className="flex flex-col gap-[30px]" aria-label="Log">
      <div className="section-head">
        <h1 className="t-title">log</h1>
        <span className="hidden text-[13px] leading-[1.3] text-ink-dim sm:inline">
          type it, hit a number, add a line if you have one. ten seconds.
        </span>
        {totals && (
          <span className="t-meta ml-auto">
            {totals.titles} · {totals.hours}h
          </span>
        )}
      </div>

      <LogField onSelectNode={onSelectNode} />

      {catchUp ? (
        <CatchUp onDone={() => setCatchUp(false)} onSelectNode={onSelectNode} />
      ) : numbers.status === "loading" ? (
        <p className="t-meta">counting…</p>
      ) : numbers.status === "signed-out" ? (
        <p className="t-prose">Sign in to keep a log.</p>
      ) : numbers.status === "error" ? (
        <p className="t-prose">The log is not answering right now.</p>
      ) : (
        <LogTable
          rows={rows}
          onSelectNode={onSelectNode}
          onCatchUp={() => setCatchUp(true)}
        />
      )}
    </div>
  );
}

// ---- the field at the top --------------------------------------------------

function LogField({ onSelectNode, onLogged }: { onSelectNode: (imdbId: string) => void; onLogged?: (row: WatchedRow) => void }) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<LogCandidate[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [chosen, setChosen] = useState<LogCandidate | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [state, setState] = useState<PickedState | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const images = useImages([...candidates.map((c) => c.imdbId), ...(chosen ? [chosen.imdbId] : [])]);

  // Debounced lookup. A picked candidate freezes the list: the user is done
  // searching and is now answering "how was it?".
  useEffect(() => {
    if (chosen) return;
    const q = query.trim();
    if (q.length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      fetch("/api/taste/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q }),
      })
        .then((r) => (r.ok ? r.json() : { candidates: [] }))
        .then((d: { candidates?: LogCandidate[] }) => {
          if (!alive) return;
          setCandidates(d.candidates ?? []);
          setCursor(-1);
        })
        .catch(() => {});
    }, 180);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, chosen]);

  const reset = useCallback(() => {
    setQuery("");
    setCandidates([]);
    setCursor(-1);
    setChosen(null);
    setScore(null);
    setState(null);
    setSeason(null);
    setNote("");
    setError(null);
  }, []);

  function pick(c: LogCandidate) {
    setChosen(c);
    setCandidates([]);
    setCursor(-1);
    setScore(null);
    setState(null);
    setNote("");
    setSeason(c.kind === "series" ? (c.seasons?.[0]?.season ?? null) : null);
    // The row of ten listens on the document, so the field lets go of the
    // keyboard the moment there is something to rate.
    inputRef.current?.blur();
  }

  const submit = useCallback(async () => {
    if (!chosen || saving) return;
    if (score == null && state == null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/taste/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imdbId: chosen.imdbId,
          ...(score != null ? { score } : { state }),
          ...(chosen.kind === "series" && season !== null ? { season } : {}),
          ...(score != null && note.trim() ? { text: note.trim() } : {}),
        }),
      });
      if (res.status === 401) return setError("sign in to keep a log");
      if (!res.ok) return setError("that did not save");
      const body = (await res.json()) as { row: WatchedRow };
      reset();
      inputRef.current?.focus();
      onLogged?.(body.row);
      bumpLog();
    } catch {
      setError("that did not save");
    } finally {
      setSaving(false);
    }
  }, [chosen, saving, score, state, season, note, reset, onLogged]);

  // Escape backs out of whatever is picked, and ⏎ logs it — both from
  // anywhere on the page, since rating is done with the keyboard and the
  // field itself has let go of focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "Escape") {
        e.preventDefault();
        return reset();
      }
      if (e.key === "Enter" && chosen && !typing) {
        e.preventDefault();
        void submit();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [chosen, reset, submit]);

  function onFieldKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (candidates.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setCursor((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return next < -1 ? candidates.length - 1 : next >= candidates.length ? -1 : next;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const at = cursor >= 0 ? cursor : 0;
      if (candidates[at]) pick(candidates[at]);
    }
  }

  const seasons = chosen?.kind === "series" ? (chosen.seasons ?? []) : [];
  const poster = chosen ? images[chosen.imdbId]?.url : null;

  return (
    <div className="flex max-w-[1000px] flex-col gap-[18px]">
      <div className="flex h-[46px] items-center gap-[12px] border-b border-[color:var(--line-input)]">
        <span className="tnum text-[15px] leading-none text-ink-ghost">&gt;</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length < 2) {
              setCandidates([]);
              setCursor(-1);
            }
          }}
          onKeyDown={onFieldKeyDown}
          aria-label="what did you watch?"
          placeholder="what did you watch?"
          // the board sets what you type here in Geist at 17px, not in mono: it is a
          // title, not a figure (design/boards-v5/Log.dc.html)
          className="min-w-0 flex-1 bg-transparent text-[17px] leading-none text-ink outline-none placeholder:text-ink-faint"
        />
        <span className="t-meta ml-auto hidden shrink-0 sm:inline">↑↓ to pick · ⏎ to open</span>
      </div>

      {!chosen && candidates.length > 0 && (
        <ul className="flex flex-col" role="listbox" aria-label="titles">
          {candidates.map((c, i) => (
            <li key={c.imdbId}>
              <button
                type="button"
                role="option"
                aria-selected={cursor === i}
                onClick={() => pick(c)}
                className="row row-pick w-full grid-cols-[26px_minmax(0,1fr)] text-left sm:grid-cols-[26px_minmax(0,340px)_48px_74px_minmax(0,1fr)]"
              >
                {images[c.imdbId]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[c.imdbId]!.url!} alt="" className="poster-mark" />
                ) : (
                  <span className="poster-mark" />
                )}
                <span className={`t-row truncate ${cursor === i ? "text-ink" : "text-ink-dim"}`}>{c.name}</span>
                <span className="t-meta hidden text-ink-faint sm:inline">{c.year ?? ""}</span>
                <span className="hidden text-[12.5px] text-ink-dim sm:inline">{c.kind === "series" ? "show" : "film"}</span>
                <span className="t-meta hidden truncate sm:inline">
                  {c.seasons?.length ? `${c.seasons.length} season${c.seasons.length === 1 ? "" : "s"}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <div className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-[14px]">
            <button type="button" onClick={() => onSelectNode(chosen.imdbId)} aria-label={chosen.name}>
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" className="poster-mark poster-mark-md" />
              ) : (
                <span className="poster-mark poster-mark-md" />
              )}
            </button>
            <span className="text-[16px] font-semibold leading-none text-ink">{chosen.name}</span>
            <span className="t-meta text-[12px] text-ink-faint">
              {[chosen.year, chosen.kind === "series" ? "show" : "film"].filter(Boolean).join(" · ")}
            </span>
            <span className="t-meta ml-auto hidden sm:inline">{chosen.imdbId}</span>
          </div>

          <div className="flex flex-col gap-[10px]">
            <ScoreRow value={score} onChange={(s) => { setScore(s); setState(null); }} keyboard />
            <div className="flex items-center gap-[18px]">
              {(["want", "seen"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={state === s}
                  onClick={() => {
                    setState(s);
                    setScore(null);
                  }}
                  className={`t-link ${state === s ? "text-ink" : ""}`}
                >
                  {s === "seen" ? "seen, not rated" : "want"}
                </button>
              ))}
            </div>
          </div>

          {seasons.length > 0 && (
            <div className="flex flex-wrap items-center gap-[10px]">
              <span className="t-meta">season</span>
              {seasons.map((s) => (
                <button
                  key={s.season}
                  type="button"
                  onClick={() => setSeason(s.season)}
                  className={`tnum text-[12.5px] ${season === s.season ? "border-b border-ink text-ink" : "text-ink-faint hover:text-ink"}`}
                >
                  {s.season}
                </button>
              ))}
            </div>
          )}

          <div className="flex h-[42px] items-center gap-[12px] border-b border-[color:var(--line-note)]">
            <span className="tnum text-[13px] leading-none text-ink-ghost">#</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
              aria-label="one line about it"
              placeholder="say one line about it, or just log it"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
            />
            <span className="t-meta ml-auto hidden shrink-0 md:inline">optional · stored word for word</span>
          </div>

          <div className="flex items-center gap-[16px]">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || (score == null && state == null)}
              className="btn btn-outline disabled:opacity-40"
            >
              {saving ? "logging…" : "log it"}
            </button>
            <span className="t-meta">⏎</span>
            <button type="button" onClick={reset} className="t-link">
              cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}
