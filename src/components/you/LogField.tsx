"use client";
/**
 * The log field: the one input at the top of You. Type a title, pick it from
 * the candidates, choose a bucket (and a season for a show), optionally say
 * one line, done — the ten-second loop from SPEC v4, story 61.
 *
 * Everything it knows comes from POST /api/taste/log; this component never
 * resolves a title or writes a row itself. Styling is deliberately plain
 * (existing tokens only): chunk C restyles it from the winning board.
 */
import { useEffect, useRef, useState } from "react";
import { useImages } from "@/components/chat/useImages";
import type { WatchedRow } from "@/lib/taste/types";

export interface LogCandidate {
  imdbId: string;
  name: string;
  year: number | null;
  kind: "movie" | "series";
  seasons: { season: number; episodes: number }[] | null;
}

/** The four buckets the log offers. `unseen` is a swipe verb, not a log one. */
const BUCKETS: { rating: "liked" | "meh" | "want" | "seen"; label: string }[] = [
  { rating: "liked", label: "Liked" },
  { rating: "meh", label: "Meh" },
  { rating: "want", label: "Want" },
  { rating: "seen", label: "Seen" },
];

interface Props {
  /** Called with the stored row after a successful log. */
  onLogged?: (row: WatchedRow) => void;
  placeholder?: string;
}

export function LogField({ onLogged, placeholder = "what did you watch?" }: Props) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<LogCandidate[]>([]);
  const [chosen, setChosen] = useState<LogCandidate | null>(null);
  const [season, setSeason] = useState<number | "">("");
  const [line, setLine] = useState("");
  const [rating, setRating] = useState<(typeof BUCKETS)[number]["rating"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const images = useImages(candidates.map((c) => c.imdbId));

  // Debounced lookup. A chosen candidate freezes the list: the user is done
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
        .then((d: { candidates?: LogCandidate[] }) => alive && setCandidates(d.candidates ?? []))
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
    setChosen(null);
    setSeason("");
    setLine("");
    setRating(null);
    setError(null);
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
          ...(chosen.kind === "series" && season !== "" ? { season } : {}),
          ...(line.trim() ? { text: line.trim() } : {}),
        }),
      });
      if (res.status === 401) {
        setError("sign in to keep a log");
        return;
      }
      if (!res.ok) {
        setError("that did not save");
        return;
      }
      const body = (await res.json()) as { row: WatchedRow };
      reset();
      inputRef.current?.focus();
      onLogged?.(body.row);
    } catch {
      setError("that did not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        value={chosen ? `${chosen.name}${chosen.year ? ` (${chosen.year})` : ""}` : query}
        onChange={(e) => {
          setChosen(null);
          setRating(null);
          setQuery(e.target.value);
          // Clearing the field clears the list here rather than in the effect,
          // so no render cascades out of it.
          if (e.target.value.trim().length < 2) setCandidates([]);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") reset();
          if (e.key === "Enter" && !chosen && candidates[0]) setChosen(candidates[0]);
        }}
        placeholder={placeholder}
        aria-label="log a title"
        className="h-10 w-full rounded-panel border border-line bg-raised px-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
      />

      {!chosen && candidates.length > 0 && (
        <ul className="divide-y divide-line">
          {candidates.map((c) => (
            <li key={c.imdbId}>
              <button
                type="button"
                onClick={() => setChosen(c)}
                className="flex w-full items-center gap-3 py-2 text-left hover:text-accent"
              >
                {images[c.imdbId]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[c.imdbId]!.url!} alt="" className="h-12 w-8 rounded-sm object-cover" />
                ) : (
                  <span className="h-12 w-8 rounded-sm bg-raised" />
                )}
                <span className="text-[15px] text-ink">{c.name}</span>
                <span className="font-mono text-[11px] text-ink-faint">
                  {c.year ?? "—"} {c.kind === "series" ? "· show" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {BUCKETS.map((b) => (
              <button
                key={b.rating}
                type="button"
                onClick={() => setRating(b.rating)}
                aria-pressed={rating === b.rating}
                className={`h-8 rounded-full px-3 text-[12.5px] ${
                  rating === b.rating ? "bg-accent font-semibold text-black" : "border border-line text-ink-dim hover:text-ink"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {chosen.kind === "series" && (
            <label className="flex items-center gap-2 font-mono text-[11px] text-ink-faint">
              season
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-8 rounded-panel border border-line bg-raised px-2 text-[12.5px] text-ink"
              >
                <option value="">—</option>
                {(chosen.seasons ?? []).map((s) => (
                  <option key={s.season} value={s.season}>
                    {s.season}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex gap-2">
            <input
              value={line}
              onChange={(e) => setLine(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
                if (e.key === "Escape") reset();
              }}
              placeholder="one line about it (optional)"
              aria-label="one line about it"
              className="h-9 flex-1 rounded-panel border border-line bg-raised px-3 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!rating || saving}
              className="h-9 rounded-full bg-accent px-4 text-[12.5px] font-semibold text-black disabled:opacity-40"
            >
              {saving ? "saving…" : "Done"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="font-mono text-[11px] text-danger">{error}</p>}
    </div>
  );
}
