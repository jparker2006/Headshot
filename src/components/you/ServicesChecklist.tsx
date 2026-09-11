"use client";
/**
 * What you pay for. Board C has no toggle control and no filled chip, so this
 * is the same grammar as every other list: a 38px row with the name and the
 * state as a `.t-link` word (DESIGN.md → You → Services). The ones you pay for
 * sit at `--ink`, the rest at `--ink-dim`; a tap saves immediately, because a
 * Save button for six words is chrome.
 *
 * Shared with onboarding, which asks for the heading and a Continue.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Provider } from "@/lib/taste/providers";

interface Props {
  /** Called after a successful save (onboarding advances a step). */
  onSaved?: () => void;
  /** Onboarding mode: the heading, the explainer and "Continue". */
  intro?: boolean;
}

export function ServicesChecklist({ onSaved, intro = false }: Props) {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Set<number>>(new Set());

  useEffect(() => {
    let alive = true;
    void fetch("/api/taste/services", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { providers: Provider[]; providerIds: number[] } | null) => {
        if (!alive || !body) return;
        setProviders(body.providers);
        setChosen(new Set(body.providerIds));
        latest.current = new Set(body.providerIds);
      })
      .catch(() => {
        if (alive) setError("could not load the list. reload the page.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback(
    async (ids: Set<number>) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/taste/services", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ providerIds: [...ids] }),
        });
        if (!res.ok) throw new Error(String(res.status));
        onSaved?.();
      } catch {
        setError("that did not save. try again.");
      } finally {
        setSaving(false);
      }
    },
    [onSaved],
  );

  const toggle = (id: number) => {
    const next = new Set(latest.current);
    if (!next.delete(id)) next.add(id);
    latest.current = next;
    setChosen(next);
    if (!intro) void save(next);
  };

  return (
    <section className="flex flex-col gap-[12px]" aria-label="Services">
      <div className="section-head">
        <h2 className="t-title">{intro ? "what do you pay for?" : "services"}</h2>
        <span className="t-sub hidden sm:inline">tonight only picks things you can open</span>
        {!intro && <span className="t-meta ml-auto">{chosen.size} of {providers?.length ?? 0}</span>}
      </div>

      {providers === null ? (
        <p className="t-meta">reading the list…</p>
      ) : (
        <div className="flex flex-col">
          {providers.map((p) => {
            const on = chosen.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                aria-pressed={on}
                className="row grid-cols-[minmax(0,1fr)_44px] text-left"
              >
                <span className={`truncate text-[14px] ${on ? "font-medium text-ink" : "text-ink-dim"}`}>{p.name}</span>
                <span className={`t-link justify-self-end ${on ? "text-ink" : "text-ink-faint"}`}>{on ? "on" : "off"}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-[13px] text-danger">{error}</p>}

      {intro && (
        <button type="button" onClick={() => void save(chosen)} disabled={saving} className="btn btn-outline mt-[10px] self-start disabled:opacity-40">
          {saving ? "saving…" : "Continue"}
        </button>
      )}
    </section>
  );
}
