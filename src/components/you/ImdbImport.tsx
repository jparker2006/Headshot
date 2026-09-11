"use client";
/**
 * The IMDb ratings import. One beat instead of three: the export carries the
 * IMDb id of every title, so there is no name matching to do and nothing for a
 * human to review — the id is either in the industry graph or it is not, and
 * the ones that are not are listed as skipped rather than guessed at.
 */
import { useCallback, useState } from "react";

interface ImportResult {
  source: string;
  parsed: number;
  imported: number;
  skipped: number;
  unmatched: { name: string; year: number | null; imdbId?: string }[];
}

interface Props {
  /** Called once the import is in. */
  onDone?: () => void;
}

export function ImdbImport({ onDone }: Props) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (form: HTMLFormElement) => {
      setBusy(true);
      setError(null);
      try {
        const file = new FormData(form).get("file");
        if (!(file instanceof File) || file.size === 0) {
          setError("Pick the ratings.csv from your IMDb export.");
          return;
        }
        const body = new FormData();
        body.set("source", "imdb");
        body.set("file", file);
        const res = await fetch("/api/taste/import", { method: "POST", body });
        if (!res.ok) throw new Error(String(res.status));
        setResult((await res.json()) as ImportResult);
        onDone?.();
      } catch {
        setError("That import didn't go through. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [onDone],
  );

  return (
    <section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void upload(e.currentTarget);
        }}
      >
        <label className="flex items-center justify-between gap-4 py-2.5">
          <span className="text-[13.5px] text-ink-dim">ratings.csv</span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="max-w-[60%] text-[13px] text-ink-dim file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-3 file:py-1.5 file:text-[12.5px] file:text-ink hover:file:border-line-strong"
          />
        </label>

        {error && <p className="mt-4 text-[13px] text-ink-dim">{error}</p>}
        {result && !error && (
          <div className="mt-4 space-y-1">
            <p className="text-[13px] text-ink-dim">
              Imported {result.imported} of {result.parsed} ratings. 7 and up counts as liked, below that as meh.
            </p>
            {result.skipped > 0 && (
              <p className="text-[12.5px] text-ink-faint">
                {result.skipped} not in the graph and skipped
                {result.unmatched.length > 0 && <> — {result.unmatched.slice(0, 5).map((r) => r.name).join(", ")}</>}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-5">
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-full bg-accent px-4 text-[12.5px] font-semibold text-bg transition-[filter] duration-[120ms] enabled:hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "Importing…" : "Import"}
          </button>
          <span className="text-[12.5px] text-ink-faint">Replaces your previous IMDb import.</span>
        </div>
      </form>
    </section>
  );
}
