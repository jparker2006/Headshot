"use client";
/**
 * The IMDb ratings import. One beat instead of three: the export carries the
 * IMDb id of every title, so there is no name matching to do and nothing for a
 * human to review — the id is either in the industry graph or it is not, and
 * the ones that are not are counted as skipped rather than guessed at.
 */
import { useCallback, useState } from "react";
import { FilePick, ImportRow } from "./importRow";

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
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async () => {
    if (!file) return setError("pick the ratings.csv from your IMDb export");
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("source", "imdb");
      body.set("file", file);
      const res = await fetch("/api/taste/import", { method: "POST", body });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as ImportResult);
      onDone?.();
    } catch {
      setError("that import did not go through. try again.");
    } finally {
      setBusy(false);
    }
  }, [file, onDone]);

  const note = error
    ? error
    : result
      ? `imported ${result.imported} of ${result.parsed}${result.skipped ? ` · ${result.skipped} not in the graph` : ""}`
      : "your ratings → export · your number comes across as it is";

  return (
    <ImportRow
      name="IMDb"
      note={note}
      controls={
        <>
          <FilePick name="file" label="ratings.csv" chosen={file?.name ?? null} onPick={setFile} />
          <button type="button" onClick={() => void upload()} disabled={busy || !file} className="tap disabled:opacity-40">
            <span className="t-link">{busy ? "importing…" : "replace"}</span>
          </button>
        </>
      }
    />
  );
}
