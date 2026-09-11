"use client";
import { useRef, useState } from "react";

interface Hit { imdbId: string; name: string; kind: "person" | "title"; titleType: string; year: number }

export function SearchBox({ onPick }: { onPick: (imdbId: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(value)}`)
        .then((r) => r.json())
        .then((d) => setHits(d.hits ?? []))
        .catch(() => setHits([]));
    }, 150);
  };

  return (
    <div className="relative w-[280px]">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          search(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Jump to a person or title"
        className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-[13px] text-ink outline-none ring-1 ring-line placeholder:text-ink-faint focus:ring-accent/60"
        aria-label="Search the graph"
      />
      {open && hits.length > 0 && (
        <ul className="panel absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto py-1">
          {hits.map((h) => (
            <li key={h.imdbId}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(h.imdbId);
                  setQ("");
                  setHits([]);
                  setOpen(false);
                }}
                className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-white/5"
              >
                <span className={h.kind === "title" ? "text-title" : "text-ink"}>{h.name}</span>
                <span className="text-[11px] text-ink-faint">{h.kind === "title" ? `${h.titleType} ${h.year || ""}` : "person"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
