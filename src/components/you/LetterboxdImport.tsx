"use client";
/**
 * The Letterboxd CSV import, lifted out of the onboarding page so You and
 * onboarding share one control. Behaviour is unchanged: POST the chosen CSVs,
 * review the shakiest matches, then confirm the corrections.
 */
import { useCallback, useState } from "react";

interface ReviewItem {
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

interface SearchHit {
  imdbId: string;
  name: string;
  year: number;
  kind: string;
}

interface Props {
  /** Called once the import (and any corrections) are in. */
  onDone?: () => void;
  /** Onboarding mode: the big heading, the explainer and a Skip. */
  intro?: boolean;
  /** Onboarding's "Skip"; omitted on You, where there is nothing to skip past. */
  onSkip?: () => void;
}

export function LetterboxdImport({ onDone, intro = false, onSkip }: Props) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, string | null>>({});
  const [done, setDone] = useState<number | null>(null);

  const upload = useCallback(async (form: HTMLFormElement) => {
    setBusy(true);
    setError(null);
    try {
      const data = new FormData(form);
      // Drop the empty file inputs so the route sees only what was chosen.
      const body = new FormData();
      for (const key of ["ratings", "watched", "watchlist"]) {
        const file = data.get(key);
        if (file instanceof File && file.size > 0) body.set(key, file);
      }
      if ([...body.keys()].length === 0) {
        setError("Pick at least one CSV from your Letterboxd export.");
        return;
      }
      const res = await fetch("/api/taste/import", { method: "POST", body });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as ImportResult);
    } catch {
      setError("That import didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const confirm = useCallback(async () => {
    const list = result?.review ?? [];
    const payload = list
      .filter((item) => fixes[item.name] !== undefined && fixes[item.name] !== item.imdbId)
      .map((item) => ({ name: item.name, year: item.year, imdbId: fixes[item.name] }));
    setBusy(true);
    try {
      if (payload.length > 0) {
        await fetch("/api/taste/import/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fixes: payload }),
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
      <section className={intro ? "mt-8" : ""}>
        {intro && <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-balance text-ink">Check the shaky ones</h1>}
        <p className={`max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-dim ${intro ? "mt-3" : ""}`}>
          {result.imported} of {result.parsed} rows matched. These are the {result.review.length} least certain — fix any that are wrong, then carry on. Watched but unrated counts as seen, not liked.
        </p>
        {result.unmatched.length > 0 && (
          <p className="mt-2 text-[12.5px] tabular-nums text-ink-faint">{result.unmatched.length} not found in the graph and skipped</p>
        )}

        <div className={intro ? "mt-7" : "mt-4"}>
          {result.review.map((item) => (
            <ReviewRow
              key={`${item.name}|${item.year}`}
              item={item}
              chosen={fixes[item.name] === undefined ? item.imdbId : fixes[item.name]}
              onChoose={(imdbId) => setFixes((prev) => ({ ...prev, [item.name]: imdbId }))}
            />
          ))}
        </div>

        <button
          onClick={() => void confirm()}
          disabled={busy}
          className={`mt-8 rounded-full bg-accent font-semibold text-bg transition-[filter] duration-[120ms] enabled:hover:brightness-110 disabled:opacity-40 ${
            intro ? "h-11 px-5 text-[13.5px]" : "h-9 px-4 text-[12.5px]"
          }`}
        >
          {busy ? "Saving…" : "Looks right"}
        </button>
      </section>
    );
  }

  return (
    <section className={intro ? "mt-8" : ""}>
      {intro && (
        <>
          <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-balance text-ink">Bring your Letterboxd</h1>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-dim">
            Settings → Import &amp; Export → Export your data. Drop the CSVs in; re-uploading later replaces what is here rather than piling on.
          </p>
        </>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void upload(e.currentTarget);
        }}
        className={intro ? "mt-7" : ""}
      >
        {(["ratings", "watched", "watchlist"] as const).map((key) => (
          <label key={key} className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-[13.5px] text-ink-dim">{key}.csv</span>
            <input
              type="file"
              name={key}
              accept=".csv,text/csv"
              className="max-w-[60%] text-[13px] text-ink-dim file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-3 file:py-1.5 file:text-[12.5px] file:text-ink hover:file:border-line-strong"
            />
          </label>
        ))}

        {error && <p className="mt-4 text-[13px] text-ink-dim">{error}</p>}
        {done !== null && !error && <p className="mt-4 text-[13px] text-ink-dim">Imported {done} rows.</p>}

        <div className={`flex items-center gap-5 ${intro ? "mt-8" : "mt-3"}`}>
          <button
            type="submit"
            disabled={busy}
            className={`rounded-full bg-accent font-semibold text-bg transition-[filter] duration-[120ms] enabled:hover:brightness-110 disabled:opacity-40 ${
              intro ? "h-11 px-5 text-[13.5px]" : "h-9 px-4 text-[12.5px]"
            }`}
          >
            {busy ? "Matching…" : "Import"}
          </button>
          {onSkip && (
            <button type="button" onClick={onSkip} className="text-[12.5px] text-ink-faint transition-colors duration-[120ms] hover:text-ink">
              Skip
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

/** One worst-match row: what we guessed, and a search box to say otherwise. */
function ReviewRow({
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
    <div className="border-t border-line py-3 first:border-t-0">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-ink">
            {item.name}
            {item.year !== null && <span className="ml-2 text-[12.5px] tabular-nums text-ink-faint">{item.year}</span>}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-ink-dim">
            matched to <span className={chosen === null ? "text-ink-faint line-through" : "text-ink"}>{label}</span>
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-full border border-line px-3 py-1 text-[12.5px] text-ink-dim transition-colors duration-[120ms] hover:border-line-strong hover:text-ink"
        >
          {open ? "Close" : "Not it"}
        </button>
      </div>

      {open && (
        <div className="mt-3">
          <input
            value={query}
            onChange={(e) => void search(e.target.value)}
            placeholder="Search the graph…"
            className="h-10 w-full rounded-full border border-line bg-transparent px-4 text-[14px] text-ink outline-none transition-colors duration-[120ms] placeholder:text-ink-faint focus:border-accent"
          />
          <div className="mt-2">
            {hits.map((hit) => (
              <button
                key={hit.imdbId}
                onClick={() => {
                  onChoose(hit.imdbId);
                  setOpen(false);
                }}
                className="block w-full py-1.5 text-left text-[13.5px] text-ink-dim transition-colors duration-[120ms] hover:text-ink"
              >
                {hit.name} <span className="text-[12px] tabular-nums text-ink-faint">{hit.year}</span>
              </button>
            ))}
            <button
              onClick={() => {
                onChoose(null);
                setOpen(false);
              }}
              className="mt-1 block py-1.5 text-[12.5px] text-ink-faint transition-colors duration-[120ms] hover:text-ink"
            >
              None of these — drop it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
