"use client";
/**
 * The Netflix viewing-activity import, same three beats as Letterboxd: post
 * the CSV, look at the shakiest matches, confirm.
 *
 * The one difference is what it can know. Netflix records that you pressed
 * play and nothing else, so every row lands in the neutral `seen` bucket and
 * the screen says so rather than letting anyone believe it means "liked".
 */
import { useCallback, useState } from "react";
import { ReviewRow, type ReviewItem } from "./LetterboxdImport";

interface ImportResult {
  source: string;
  parsed: number;
  imported: number;
  skipped: number;
  unmatched: { name: string; year: number | null }[];
  review: ReviewItem[];
}

interface Props {
  /** Called once the import (and any corrections) are in. */
  onDone?: () => void;
}

export function NetflixImport({ onDone }: Props) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, string | null>>({});
  const [done, setDone] = useState<number | null>(null);

  const upload = useCallback(async (form: HTMLFormElement) => {
    setBusy(true);
    setError(null);
    try {
      const file = new FormData(form).get("file");
      if (!(file instanceof File) || file.size === 0) {
        setError("Pick NetflixViewingHistory.csv.");
        return;
      }
      const body = new FormData();
      body.set("source", "netflix");
      body.set("file", file);
      const res = await fetch("/api/taste/import", { method: "POST", body });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as ImportResult);
      setDone(null);
    } catch {
      setError("That import didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const confirm = useCallback(async () => {
    const payload = (result?.review ?? [])
      .filter((item) => fixes[item.name] !== undefined && fixes[item.name] !== item.imdbId)
      .map((item) => ({ name: item.name, year: item.year, from: item.imdbId, imdbId: fixes[item.name] }));
    setBusy(true);
    try {
      if (payload.length > 0) {
        await fetch("/api/taste/import/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: "netflix", fixes: payload }),
        });
      }
      setDone(result?.imported ?? 0);
      setResult(null);
      setFixes({});
      onDone?.();
    } finally {
      setBusy(false);
    }
  }, [fixes, onDone, result]);

  if (result) {
    return (
      <section>
        <p className="max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-dim">
          {result.imported} of {result.parsed} titles matched — episodes of the same show counted as one. These are the {result.review.length} least
          certain; fix any that are wrong. Netflix only knows you played it, so every one of them is filed as seen, never liked.
        </p>
        {result.skipped > 0 && <p className="mt-2 text-[12.5px] tabular-nums text-ink-faint">{result.skipped} not found in the graph and skipped</p>}

        <div className="mt-4">
          {result.review.map((item) => (
            <ReviewRow
              key={item.name}
              item={item}
              chosen={fixes[item.name] === undefined ? item.imdbId : fixes[item.name]}
              onChoose={(imdbId) => setFixes((prev) => ({ ...prev, [item.name]: imdbId }))}
            />
          ))}
        </div>

        <button
          onClick={() => void confirm()}
          disabled={busy}
          className="mt-8 h-9 rounded-full bg-accent px-4 text-[12.5px] font-semibold text-bg transition-[filter] duration-[120ms] enabled:hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Looks right"}
        </button>
      </section>
    );
  }

  return (
    <section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void upload(e.currentTarget);
        }}
      >
        <label className="flex items-center justify-between gap-4 py-2.5">
          <span className="text-[13.5px] text-ink-dim">NetflixViewingHistory.csv</span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="max-w-[60%] text-[13px] text-ink-dim file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-3 file:py-1.5 file:text-[12.5px] file:text-ink hover:file:border-line-strong"
          />
        </label>

        {error && <p className="mt-4 text-[13px] text-ink-dim">{error}</p>}
        {done !== null && !error && <p className="mt-4 text-[13px] text-ink-dim">Imported {done} titles.</p>}

        <div className="mt-3 flex items-center gap-5">
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-full bg-accent px-4 text-[12.5px] font-semibold text-bg transition-[filter] duration-[120ms] enabled:hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "Matching…" : "Import"}
          </button>
          <span className="text-[12.5px] text-ink-faint">Replaces your previous Netflix import.</span>
        </div>
      </form>
    </section>
  );
}
