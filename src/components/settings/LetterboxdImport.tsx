"use client";
/**
 * The Letterboxd CSV import, shared by You and onboarding. Behaviour is
 * unchanged: POST the chosen CSVs, review the shakiest matches, then confirm
 * the corrections. On You it is one terse row; `intro` gives onboarding the
 * heading and a Skip.
 */
import { useCallback, useState } from "react";
import { FilePick, ImportRow } from "./importRow";

export interface ReviewItem {
  name: string;
  year: number | null;
  rating: number | null;
  list: "watched" | "watchlist";
  imdbId: string;
  matchedName: string;
  matchedYear: number;
  confidence: number;
}

interface ImportResult {
  parsed: number;
  imported: number;
  unmatched: { name: string; year: number | null }[];
  review: ReviewItem[];
}

export interface SearchHit {
  imdbId: string;
  name: string;
  year: number;
  kind: string;
}

const FILES = ["ratings", "watched", "watchlist"] as const;
type FileKey = (typeof FILES)[number];

interface Props {
  /** Called once the import (and any corrections) are in. */
  onDone?: () => void;
  /** Onboarding mode: the heading, the explainer and a Skip. */
  intro?: boolean;
  /** Onboarding's "Skip"; omitted on You, where there is nothing to skip past. */
  onSkip?: () => void;
}

export function LetterboxdImport({ onDone, intro = false, onSkip }: Props) {
  const [files, setFiles] = useState<Partial<Record<FileKey, File>>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, string | null>>({});
  const [done, setDone] = useState<number | null>(null);

  const upload = useCallback(async () => {
    const body = new FormData();
    for (const key of FILES) {
      const file = files[key];
      if (file && file.size > 0) body.set(key, file);
    }
    if ([...body.keys()].length === 0) {
      setError("pick at least one CSV from your Letterboxd export");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/taste/import", { method: "POST", body });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as ImportResult);
    } catch {
      setError("that import did not go through. try again.");
    } finally {
      setBusy(false);
    }
  }, [files]);

  const confirm = useCallback(async () => {
    const list = result?.review ?? [];
    const payload = list
      .filter((item) => fixes[item.name] !== undefined && fixes[item.name] !== item.imdbId)
      .map((item) => ({ name: item.name, year: item.year, from: item.imdbId, imdbId: fixes[item.name] }));
    setBusy(true);
    try {
      if (payload.length > 0) {
        await fetch("/api/taste/import/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: "letterboxd", fixes: payload }),
        });
      }
      setDone(result?.imported ?? 0);
      setResult(null);
      setFixes({});
      setFiles({});
      onDone?.();
    } finally {
      setBusy(false);
    }
  }, [fixes, onDone, result]);

  const review = result && (
    <div className="flex flex-col gap-[10px] py-[10px]">
      <p className="t-prose max-w-[880px]">
        {result.imported} of {result.parsed} rows matched. these are the {result.review.length} least certain — fix any that are wrong, then carry on.
        watched but unrated counts as seen, not liked.
        {result.unmatched.length > 0 ? ` ${result.unmatched.length} were not in the graph and were skipped.` : ""}
      </p>
      {result.review.map((item) => (
        <ReviewRow
          key={`${item.name}|${item.year}`}
          item={item}
          chosen={fixes[item.name] === undefined ? item.imdbId : fixes[item.name]}
          onChoose={(imdbId) => setFixes((prev) => ({ ...prev, [item.name]: imdbId }))}
        />
      ))}
      <button type="button" onClick={() => void confirm()} disabled={busy} className="btn btn-outline self-start disabled:opacity-40">
        {busy ? "saving…" : "Looks right"}
      </button>
    </div>
  );

  const picks = FILES.map((key) => (
    <FilePick key={key} name={key} label={`${key}.csv`} chosen={files[key]?.name ?? null} onPick={(f) => setFiles((prev) => ({ ...prev, [key]: f ?? undefined }))} />
  ));

  if (intro) {
    return (
      <section className="flex flex-col gap-[14px]" aria-label="Letterboxd">
        <div className="section-head">
          <h1 className="t-title">bring your Letterboxd</h1>
          <span className="t-sub hidden sm:inline">ratings become liked or meh; the watchlist becomes want</span>
        </div>
        <p className="t-prose max-w-[880px]">
          Settings → Import &amp; Export → Export your data. drop the CSVs in; re-uploading later replaces what is here rather than piling on.
        </p>
        <div className="flex flex-wrap items-center gap-[18px]">{picks}</div>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        {review}
        {!result && (
          <div className="flex items-center gap-[16px]">
            <button type="button" onClick={() => void upload()} disabled={busy} className="btn btn-outline disabled:opacity-40">
              {busy ? "matching…" : "Import"}
            </button>
            {onSkip && (
              <button type="button" onClick={onSkip} className="t-link">
                skip
              </button>
            )}
          </div>
        )}
      </section>
    );
  }

  const note = error ? error : done !== null ? `imported ${done} rows` : "settings → import & export · ratings become liked or meh";

  return (
    <>
      <ImportRow
        name="Letterboxd"
        note={note}
        controls={
          <>
            {picks}
            <button type="button" onClick={() => void upload()} disabled={busy} className="t-link disabled:opacity-40">
              {busy ? "matching…" : "replace"}
            </button>
          </>
        }
      />
      {review}
    </>
  );
}

/** One worst-match row: what we guessed, and a search box to say otherwise. */
export function ReviewRow({
  item,
  chosen,
  onChoose,
}: {
  item: ReviewItem;
  chosen: string | null;
  onChoose: (imdbId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return;
    const body = (await res.json()) as { hits: SearchHit[] };
    setHits(body.hits.filter((h) => h.kind === "title"));
  }, []);

  const label =
    chosen === null ? "dropped" : chosen === item.imdbId ? `${item.matchedName} · ${item.matchedYear}` : (hits.find((h) => h.imdbId === chosen)?.name ?? chosen);

  return (
    <div className="flex flex-col">
      <div className="row grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)_auto]">
        <span className="t-row truncate">{item.name}</span>
        <span className="tnum text-[11.5px] leading-[1.3] text-ink-faint">{item.year ?? ""}</span>
        <span className={`truncate text-[13px] ${chosen === null ? "text-ink-ghost line-through" : "text-ink-dim"}`}>{label}</span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="t-link justify-self-end">
          {open ? "close" : "not it"}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-[6px] pb-[10px]">
          <div className="flex h-[46px] items-center gap-[12px] border-b border-[color:var(--line-input)]">
            <span className="tnum text-[15px] leading-none text-ink-ghost">&gt;</span>
            <input
              value={query}
              onChange={(e) => void search(e.target.value)}
              aria-label={`find the right title for ${item.name}`}
              placeholder="search the graph"
              className="t-input min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-ghost"
            />
          </div>
          {hits.map((hit) => (
            <button
              key={hit.imdbId}
              type="button"
              onClick={() => {
                onChoose(hit.imdbId);
                setOpen(false);
              }}
              className="row row-pick grid-cols-[minmax(0,1fr)_48px] text-left"
            >
              <span className="t-row truncate text-ink-dim">{hit.name}</span>
              <span className="tnum text-[11.5px] leading-[1.3] text-ink-faint">{hit.year}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onChoose(null);
              setOpen(false);
            }}
            className="t-link self-start"
          >
            none of these — drop it
          </button>
        </div>
      )}
    </div>
  );
}
