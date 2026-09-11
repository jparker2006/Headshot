"use client";
/**
 * The six-tap provider checklist, lifted out of the onboarding page so You and
 * onboarding are the same control rather than two that drift. Behaviour is
 * unchanged: the list and the current selection come from GET
 * /api/taste/services, PUT replaces it.
 */
import { useCallback, useEffect, useState } from "react";
import type { Provider } from "@/lib/taste/providers";

interface Props {
  /** Called after a successful save (onboarding advances a step; You just says "saved"). */
  onSaved?: () => void;
  /** Onboarding mode: the big heading, the explainer and "Continue". */
  intro?: boolean;
}

export function ServicesChecklist({ onSaved, intro = false }: Props) {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
    setSaved(false);
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
      setSaved(true);
      onSaved?.();
    } catch {
      setError("That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }, [chosen, onSaved]);

  return (
    <section className={intro ? "mt-8" : ""}>
      {intro && (
        <>
          <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-balance text-ink">What do you pay for?</h1>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-dim">
            Tonight only recommends things you can actually open. If something is on none of these, you will still see it — with its rent price, not hidden.
          </p>
        </>
      )}

      <div className={intro ? "mt-7" : ""}>
        {providers === null ? (
          <p className="text-[13.5px] text-ink-faint">Loading…</p>
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

      <div className={`flex items-center gap-5 ${intro ? "mt-8" : "mt-4"}`}>
        <button
          onClick={() => void save()}
          disabled={saving}
          className={`rounded-full bg-accent font-semibold text-bg transition-[filter] duration-[120ms] enabled:hover:brightness-110 disabled:opacity-40 ${
            intro ? "h-11 px-5 text-[13.5px]" : "h-9 px-4 text-[12.5px]"
          }`}
        >
          {saving ? "Saving…" : intro ? "Continue" : "Save"}
        </button>
        <span className="text-[12.5px] tabular-nums text-ink-faint">
          {saved && !intro ? "saved · " : ""}
          {chosen.size} selected
        </span>
      </div>
    </section>
  );
}
