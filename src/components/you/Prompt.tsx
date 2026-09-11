"use client";
/**
 * The one prompt. Board C puts a single field at the bottom of every screen —
 * `> log something, or just ask` — and the log flow lives inside it rather
 * than in a second box at the top of You (DESIGN.md → You → Log field). This
 * is `LogField` and `Composer` merged: same fetches, one input.
 *
 * Two modes:
 *   ask   — `>` prompt. Typing raises title candidates above the field; ↑↓ and
 *           ⏎ pick one, ⏎ with nothing picked sends the line to the chat.
 *   log   — `#` prompt, and the field is now the optional note. Above it: the
 *           picked title, the four buckets (1 2 3 4), a season for a show, and
 *           `log it`.
 *
 * Escape backs out of whichever mode it is in. Nothing here resolves a title
 * or writes a row: every fact comes from POST /api/taste/log.
 */
import { useEffect, useRef, useState } from "react";
import { useImages } from "@/components/chat/useImages";
import type { WatchedRow } from "@/lib/taste/types";
import { bumpLog } from "./logBus";

export interface LogCandidate {
  imdbId: string;
  name: string;
  year: number | null;
  kind: "movie" | "series";
  seasons: { season: number; episodes: number }[] | null;
}

/** The four buckets the log offers, in board order. `unseen` is a swipe verb. */
const BUCKETS = ["liked", "meh", "want", "seen"] as const;
type Bucket = (typeof BUCKETS)[number];

interface Props {
  /** Put the typed line to the agent; the shell opens a thread with it. */
  onAsk: (text: string) => void;
  /** Called with the stored row after a successful log. */
  onLogged?: (row: WatchedRow) => void;
  /** Open the picked title in the drawer. */
  onSelectNode?: (imdbId: string) => void;
  placeholder?: string;
}

export function Prompt({ onAsk, onLogged, onSelectNode, placeholder = "log something, or just ask" }: Props) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<LogCandidate[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [chosen, setChosen] = useState<LogCandidate | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [rating, setRating] = useState<Bucket | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The picked title keeps its id in the list: picking clears the candidates,
  // and without this the poster it just showed would blank out.
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

  function reset() {
    setQuery("");
    setCandidates([]);
    setCursor(-1);
    setChosen(null);
    setSeason(null);
    setNote("");
    setRating(null);
    setError(null);
  }

  function pick(c: LogCandidate) {
    setChosen(c);
    setCandidates([]);
    setCursor(-1);
    setNote("");
    setRating(null);
    setSeason(c.kind === "series" ? (c.seasons?.[0]?.season ?? null) : null);
    inputRef.current?.focus();
  }

  async function submit() {
    if (!chosen || !rating || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/taste/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imdbId: chosen.imdbId,
          rating,
          ...(chosen.kind === "series" && season !== null ? { season } : {}),
          ...(note.trim() ? { text: note.trim() } : {}),
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
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      return reset();
    }
    if (chosen) {
      if (e.key === "Enter") {
        e.preventDefault();
        void submit();
        return;
      }
      // The digits are the bucket shortcuts the board prints beside the set,
      // and they only fire while the note is still empty — once you are
      // writing a line, a "2" is a "2".
      if (!note && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        setRating(BUCKETS[Number(e.key) - 1]);
      }
      return;
    }
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
      if (cursor >= 0 && candidates[cursor]) return pick(candidates[cursor]);
      const text = query.trim();
      if (!text) return;
      setQuery("");
      setCandidates([]);
      onAsk(text);
    }
  }

  const seasons = chosen?.kind === "series" ? (chosen.seasons ?? []) : [];

  return (
    <div className="flex w-full flex-col">
      {/* what the field is carrying, above it, the way the board stacks the log flow */}
      <div className="max-w-[1000px]">
        {chosen && (
          <div className="mb-[18px] flex flex-col gap-[18px]">
            <div className="flex items-center gap-[14px]">
              <button type="button" onClick={() => onSelectNode?.(chosen.imdbId)} aria-label={chosen.name}>
                {images[chosen.imdbId]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[chosen.imdbId]!.url!} alt="" className="poster-mark poster-mark-md" />
                ) : (
                  <span className="poster-mark poster-mark-md" />
                )}
              </button>
              <span className="text-[16px] font-semibold leading-none text-ink">{chosen.name}</span>
              <span className="t-meta text-ink-faint">
                {[chosen.year, chosen.kind === "series" ? "show" : "film"].filter(Boolean).join(" · ")}
              </span>
              <span className="t-meta ml-auto hidden sm:inline">{chosen.imdbId}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {BUCKETS.map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={rating === b}
                  onClick={() => setRating(b)}
                  className={`btn ${rating === b ? "btn-solid" : "btn-fill"}`}
                >
                  {b}
                </button>
              ))}
              <span className="t-meta ml-[14px] hidden sm:inline">1 2 3 4</span>
              {seasons.length > 0 && (
                <span className="ml-auto flex items-center gap-[10px]">
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
                  <span className="t-meta hidden lg:inline">· asked once, then never again</span>
                </span>
              )}
            </div>
          </div>
        )}

        {!chosen && candidates.length > 0 && (
          <ul className="mb-[10px] flex flex-col" role="listbox" aria-label="titles">
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

        {error && <p className="mb-2 text-[13px] text-danger">{error}</p>}
      </div>

      <div className="composer">
        <span className="tnum text-[13px] leading-none text-ink-ghost">{chosen ? "#" : ">"}</span>
        <input
          ref={inputRef}
          value={chosen ? note : query}
          onChange={(e) => {
            if (chosen) return setNote(e.target.value);
            setQuery(e.target.value);
            if (e.target.value.trim().length < 2) {
              setCandidates([]);
              setCursor(-1);
            }
          }}
          onKeyDown={onKeyDown}
          placeholder={chosen ? "say one line about it, or just log it" : placeholder}
          aria-label={chosen ? "one line about it" : "log something, or just ask"}
          className={`min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-faint ${chosen ? "text-[15px]" : "text-[14px]"}`}
        />
        {chosen ? (
          <>
            <span className="t-meta ml-auto hidden md:inline">optional · stored word for word</span>
            <button type="button" onClick={() => void submit()} disabled={!rating || saving} className="btn btn-outline shrink-0 disabled:opacity-40">
              {saving ? "logging…" : "log it"}
            </button>
            <span className="t-meta">⏎</span>
          </>
        ) : (
          <span className="t-meta ml-auto shrink-0">{candidates.length > 0 ? `${candidates.length} matches · ↑↓ to pick` : "⏎"}</span>
        )}
      </div>
    </div>
  );
}
