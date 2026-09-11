"use client";
/**
 * Your taste, as text: the people you keep watching, decades, TV share,
 * what you finish, counts. The map is gone from the nav; this is the part of
 * it people actually read. Names open the title drawer.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

interface Facts {
  people: { imdbId: string; name: string; count: number }[];
  eras: Record<string, number>;
  avgRuntimeFinished: number | null;
  tvShare: number | null;
  genresAvoided: string[];
}
interface Data {
  facts: Facts;
  rated: number;
  later: number;
}

export function TastePanel({ onSelectNode }: { onSelectNode: (imdbId: string) => void }) {
  const [data, setData] = useState<Data | null | "signed-out">(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/taste/map", { cache: "no-store" })
      .then(async (r) => (r.status === 401 ? "signed-out" : r.ok ? ((await r.json()) as Data) : null))
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, []);

  if (data === null) return <p className="font-mono text-[11px] text-ink-faint">reading your taste…</p>;
  if (data === "signed-out")
    return (
      <p className="text-[14px] text-ink-dim">
        <Link href="/auth/sign-in?next=/" className="text-accent">
          Sign in
        </Link>{" "}
        and rate a few things, and this page fills in.
      </p>
    );
  const { facts, rated, later } = data;
  const decades = Object.entries(facts.eras).sort((a, b) => b[1] - a[1]);
  const top = decades[0];
  return (
    <section className="space-y-8" aria-label="Your taste">
      <div className="space-y-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Your taste</h1>
        <p className="font-mono text-[11px] text-ink-faint">
          {rated} rated · {later} in later · explicit ratings only, nothing inferred
        </p>
      </div>

      {rated === 0 ? (
        <p className="text-[14px] text-ink-dim">
          Nothing rated yet.{" "}
          <Link href="/onboarding" className="text-accent">
            Import Letterboxd or swipe the deck
          </Link>
          , or just tell the chat what you love.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">you keep watching</p>
            {facts.people.length === 0 ? (
              <p className="text-[14px] text-ink-dim">No one twice yet. A few more ratings and the pattern shows.</p>
            ) : (
              <ul className="stagger divide-y divide-line">
                {facts.people.slice(0, 10).map((p) => (
                  <li key={p.imdbId} className="flex items-center justify-between py-2.5">
                    <button onClick={() => onSelectNode(p.imdbId)} className="text-[15px] font-medium text-ink underline-offset-4 decoration-accent/50 hover:underline">
                      {p.name}
                    </button>
                    <span className="font-mono text-[11px] text-ink-faint">
                      {p.count} you liked
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
            <Fact label="strongest decade" value={top ? `${top[0]}` : "—"} sub={top ? `${top[1]} liked` : undefined} />
            <Fact label="tv vs film" value={facts.tvShare !== null ? `${Math.round(facts.tvShare * 100)}% tv` : "—"} />
            <Fact label="runtime you finish" value={facts.avgRuntimeFinished ? `~${facts.avgRuntimeFinished} min` : "—"} />
            {facts.genresAvoided.length > 0 && <Fact label="only in your meh pile" value={facts.genresAvoided.slice(0, 3).join(", ")} />}
          </div>

          {decades.length > 1 && (
            <div className="space-y-2">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">by decade</p>
              <div className="flex items-end gap-2">
                {decades
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([d, n]) => (
                    <div key={d} className="flex flex-col items-center gap-1">
                      <div className="w-8 rounded-sm bg-accent/70" style={{ height: `${8 + (n / (top?.[1] ?? 1)) * 48}px` }} title={`${n} liked`} />
                      <span className="font-mono text-[10px] text-ink-faint">{d.replace("s", "")}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">{label}</p>
      <p className="mt-1 text-[18px] font-semibold tracking-tight text-ink">{value}</p>
      {sub && <p className="font-mono text-[11px] text-ink-faint">{sub}</p>}
    </div>
  );
}
