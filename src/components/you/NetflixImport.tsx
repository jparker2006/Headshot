"use client";
/**
 * The Netflix viewing-activity import, same three beats as Letterboxd: post
 * the CSV, look at the shakiest matches, confirm.
 *
 * The one difference is what it can know. Netflix records that you pressed
 * play and nothing else, so every row lands in the neutral `seen` bucket and
 * the row says so rather than letting anyone believe it means "liked".
 */
import { useCallback, useState } from "react";
import { ReviewRow, type ReviewItem } from "./LetterboxdImport";
import { FilePick, ImportRow } from "./importRow";

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
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, string | null>>({});
  const [done, setDone] = useState<number | null>(null);

  const upload = useCallback(async () => {
    if (!file) return setError("pick NetflixViewingHistory.csv");
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("source", "netflix");
      body.set("file", file);
      const res = await fetch("/api/taste/import", { method: "POST", body });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as ImportResult);
      setDone(null);
    } catch {
      setError("that import did not go through. try again.");
    } finally {
      setBusy(false);
    }
  }, [file]);

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
      setFile(null);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }, [fixes, onDone, result]);

  const note = error
    ? error
    : done !== null
      ? `imported ${done} titles`
      : "account → profile → viewing activity · everything lands as seen, never liked";

  return (
    <>
      <ImportRow
        name="Netflix"
        note={note}
        controls={
          <>
            <FilePick name="file" label="NetflixViewingHistory.csv" chosen={file?.name ?? null} onPick={setFile} />
            <button type="button" onClick={() => void upload()} disabled={busy || !file} className="t-link disabled:opacity-40">
              {busy ? "matching…" : "replace"}
            </button>
          </>
        }
      />

      {result && (
        <div className="flex flex-col gap-[10px] py-[10px]">
          <p className="t-prose max-w-[880px]">
            {result.imported} of {result.parsed} titles matched — episodes of the same show counted as one. these are the {result.review.length} least certain.
            {result.skipped > 0 ? ` ${result.skipped} were not in the graph and were skipped.` : ""}
          </p>
          {result.review.map((item) => (
            <ReviewRow
              key={item.name}
              item={item}
              chosen={fixes[item.name] === undefined ? item.imdbId : fixes[item.name]}
              onChoose={(imdbId) => setFixes((prev) => ({ ...prev, [item.name]: imdbId }))}
            />
          ))}
          <button type="button" onClick={() => void confirm()} disabled={busy} className="btn btn-outline self-start disabled:opacity-40">
            {busy ? "saving…" : "Looks right"}
          </button>
        </div>
      )}
    </>
  );
}
