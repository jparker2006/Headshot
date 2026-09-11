"use client";

/**
 * Onboarding, in the order SPEC v3 fixed: services (six taps) → Letterboxd
 * upload or skip → Tonight. The swipe deck is chunk C and slots in before the
 * last step. Styled against DESIGN.md: hairlines, no cards, one accent, space
 * instead of borders.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SignInGate } from "@/components/auth/SignInGate";
import type { Provider } from "@/lib/taste/providers";

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

const STEPS = ["Services", "Letterboxd", "Tonight"] as const;

export default function OnboardingPage() {
  return (
    <main className="field h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[680px] px-5 py-12 sm:px-10">
        <SignInGate next="/onboarding" reason="Your taste is private and lives with an account. Headshot's chat and the shared brain stay open without one.">
          {() => <Onboarding />}
        </SignInGate>
      </div>
    </main>
  );
}

function Onboarding() {
  const [step, setStep] = useState(0);

  return (
    <>
      <ol className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.08em]">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? "text-ink" : "text-ink-faint"}>
            <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span> {label}
          </li>
        ))}
      </ol>
      <div className="mt-5 h-px bg-line" />

      {step === 0 && <ServicesStep onDone={() => setStep(1)} />}
      {step === 1 && <ImportStep onDone={() => setStep(2)} />}
      {step === 2 && <DoneStep />}
    </>
  );
}

// ---- step 1: services ------------------------------------------------------

function ServicesStep({ onDone }: { onDone: () => void }) {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The checklist and the user's current selection come from the server; the
  // fetch is the external system, so the effect only hands its answer back.
  useEffect(() => {
    let alive = true;
    void fetch("/api/taste/services", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { providers: Provider[]; providerIds: number[] } | null) => {
        if (!alive || !body) return;
        setProviders(body.providers);
        setChosen(new Set(body.providerIds));
      })
      .catch(() => {
        if (alive) setError("Could not load the list. Reload the page.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback((id: number) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/taste/services", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerIds: [...chosen] }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onDone();
    } catch {
      setError("That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }, [chosen, onDone]);

  return (
    <section className="mt-8">
      <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-balance text-ink">What do you pay for?</h1>
      <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-dim">
        Tonight only recommends things you can actually open. If something is on none of these, you will still see it — with its rent price, not hidden.
      </p>

      <div className="mt-7">
        {providers === null ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">Loading…</p>
        ) : (
          providers.map((p) => {
            const on = chosen.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                aria-pressed={on}
                className="flex w-full items-center justify-between py-3 text-left transition-colors duration-[120ms]"
              >
                <span className={`text-[16px] ${on ? "text-ink" : "text-ink-dim"}`}>{p.name}</span>
                <span
                  className={`size-4 shrink-0 rounded-full border transition-all duration-[120ms] ${
                    on ? "border-accent bg-accent shadow-[0_0_12px_var(--accent)]" : "border-line-strong"
                  }`}
                />
              </button>
            );
          })
        )}
      </div>

      {error && <p className="mt-4 text-[13px] text-ink-dim">{error}</p>}

      <div className="mt-8 flex items-center gap-5">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="h-11 rounded-full bg-accent px-5 text-[13.5px] font-semibold text-bg transition-[filter] duration-[120ms] enabled:hover:brightness-110 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] tabular-nums text-ink-faint">
          {chosen.size} selected
        </span>
      </div>
    </section>
  );
}

// ---- step 2: the Letterboxd import ----------------------------------------

function ImportStep({ onDone }: { onDone: () => void }) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, string | null>>({});

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
      onDone();
    } finally {
      setBusy(false);
    }
  }, [fixes, onDone, result]);

  if (result) {
    return (
      <section className="mt-8">
        <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-balance text-ink">Check the shaky ones</h1>
        <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-dim">
          {result.imported} of {result.parsed} rows matched. These are the {result.review.length} least certain — fix any that are wrong, then carry on. Watched but unrated counts as seen, not liked.
        </p>
        {result.unmatched.length > 0 && (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] tabular-nums text-ink-faint">
            {result.unmatched.length} not found in the graph and skipped
          </p>
        )}

        <div className="mt-7">
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
          className="mt-8 h-11 rounded-full bg-accent px-5 text-[13.5px] font-semibold text-bg transition-[filter] duration-[120ms] enabled:hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Looks right"}
        </button>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-balance text-ink">Bring your Letterboxd</h1>
      <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-dim">
        Settings → Import &amp; Export → Export your data. Drop the CSVs in; re-uploading later replaces what is here rather than piling on.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void upload(e.currentTarget);
        }}
        className="mt-7"
      >
        {(["ratings", "watched", "watchlist"] as const).map((key) => (
          <label key={key} className="flex items-center justify-between gap-4 py-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">{key}.csv</span>
            <input
              type="file"
              name={key}
              accept=".csv,text/csv"
              className="max-w-[60%] text-[13px] text-ink-dim file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-3 file:py-1.5 file:text-[12.5px] file:text-ink hover:file:border-line-strong"
            />
          </label>
        ))}

        {error && <p className="mt-4 text-[13px] text-ink-dim">{error}</p>}

        <div className="mt-8 flex items-center gap-5">
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-full bg-accent px-5 text-[13.5px] font-semibold text-bg transition-[filter] duration-[120ms] enabled:hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "Matching…" : "Import"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint transition-colors duration-[120ms] hover:text-ink"
          >
            Skip
          </button>
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
            {item.year !== null && <span className="ml-2 font-mono text-[11px] tabular-nums text-ink-faint">{item.year}</span>}
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
                {hit.name} <span className="font-mono text-[11px] tabular-nums text-ink-faint">{hit.year}</span>
              </button>
            ))}
            <button
              onClick={() => {
                onChoose(null);
                setOpen(false);
              }}
              className="mt-1 block py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint transition-colors duration-[120ms] hover:text-ink"
            >
              None of these — drop it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- step 3 ----------------------------------------------------------------

function DoneStep() {
  return (
    <section className="mt-8">
      <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-balance text-ink">That&apos;s enough to start</h1>
      <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-dim">
        It knows what you pay for and what you have seen. Every pick from here comes with one real reason out of the graph.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center rounded-full bg-accent px-5 text-[13.5px] font-semibold text-bg transition-[filter] duration-[120ms] hover:brightness-110"
      >
        Go to Tonight
      </Link>
    </section>
  );
}
