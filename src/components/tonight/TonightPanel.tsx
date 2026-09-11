"use client";
/**
 * Tonight: three picks as hairline-separated rows (small poster, the reason
 * set large with names bold, a mono metadata line, Play, "later"), then the
 * deck as a compact poster strip with the Later chip. Matches
 * design/boards/Main.dc.html. Data comes from /api/tonight; this component
 * never computes a pick.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import type { TonightData, PickView } from "@/lib/picks/view";

interface Props {
  /** Open a person or title in the drawer. */
  onSelectNode: (imdbId: string) => void;
  /** Post a question into the chat ("swap the second one for something funnier"). */
  onAsk: (text: string) => void;
  /** Called when the user taps "later" on a pick. */
  onLater?: (imdbId: string) => void;
}

type State = { status: "loading" } | { status: "signed-out" } | { status: "empty" } | { status: "ready"; data: TonightData } | { status: "error"; message: string };

export function useTonight(): [State, () => void] {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    fetch("/api/tonight", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) return { status: "signed-out" } as State;
        if (r.status === 404) return { status: "empty" } as State;
        if (!r.ok) return { status: "error", message: `Tonight is unavailable (${r.status})` } as State;
        const data = (await r.json()) as TonightData;
        return data.picks.length ? ({ status: "ready", data } as State) : ({ status: "empty" } as State);
      })
      .catch((e: Error) => ({ status: "error", message: e.message }) as State)
      .then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, [nonce]);
  return [state, () => setNonce((n) => n + 1)];
}

export function TonightPanel({ onSelectNode, onAsk, onLater }: Props) {
  const [state, refresh] = useTonight();
  const [later, setLater] = useState<Set<string>>(() => new Set());

  if (state.status === "loading") return <p className="font-mono text-[11px] text-ink-faint">finding three for tonight…</p>;
  if (state.status === "signed-out")
    return (
      <div className="space-y-2">
        <p className="text-[15px] leading-snug text-ink">want three picks for tonight, on the services you already pay for?</p>
        <Link href="/auth/sign-in?next=/onboarding" className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[12.5px] font-semibold text-black">
          Sign in with a magic link
        </Link>
      </div>
    );
  if (state.status === "empty")
    return (
      <div className="space-y-2">
        <p className="text-[15px] leading-snug text-ink">nothing for tonight yet. tell me what you pay for and what you&apos;ve seen, and I&apos;ll have three ready.</p>
        <Link href="/onboarding" className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[12.5px] font-semibold text-black">
          Set up Tonight
        </Link>
      </div>
    );
  if (state.status === "error")
    return (
      <p className="text-[13px] text-ink-dim">
        {state.message}.{" "}
        <button type="button" onClick={refresh} className="text-accent">
          try again
        </button>
      </p>
    );

  const { data } = state;
  const picks = data.picks.filter((p) => !later.has(p.imdbId));
  const dismiss = (id: string) => {
    setLater((s) => new Set(s).add(id));
    onLater?.(id);
  };
  const stamp = new Date(data.generatedAt);
  return (
    <section className="space-y-6" aria-label="Tonight">
      <div className="space-y-1.5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
          {stamp.toLocaleDateString(undefined, { weekday: "long" })} · {picks.filter((p) => p.kind === "continue").length ? "one to continue, " : ""}
          {picks.filter((p) => p.kind === "start").length} new · on stuff you already pay for
        </p>
        <p className="text-[15px] leading-snug text-ink">ok, three for tonight.</p>
      </div>

      <div>
        {picks.map((p, i) => (
          <PickRow key={p.imdbId} pick={p} last={i === picks.length - 1} onSelectNode={onSelectNode} onLater={() => dismiss(p.imdbId)} />
        ))}
      </div>

      {data.deck.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">today&apos;s deck · {data.deck.length}</span>
              <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-dim">later · {data.laterCount + later.size}</span>
            </div>
            <span className="font-mono text-[10.5px] text-ink-faint">seen it · liked it · not for me · want to</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {data.deck.map((d) => (
              <button key={d.imdbId} type="button" onClick={() => onSelectNode(d.imdbId)} className="aspect-[3/4] overflow-hidden rounded-md bg-white/[0.05] ring-1 ring-line hover:ring-accent/60" title={`${d.name}: ${d.reason.text}`}>
                {d.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-full items-end p-1.5 text-left text-[10.5px] leading-tight text-ink-dim">{d.name}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button" onClick={() => onAsk("something funnier, under 40 minutes")} className="font-mono text-[11px] text-ink-faint hover:text-ink">
        none of these? say what you&apos;re in the mood for ↵
      </button>
    </section>
  );
}

function PickRow({ pick, last, onSelectNode, onLater }: { pick: PickView; last: boolean; onSelectNode: (id: string) => void; onLater: () => void }) {
  const meta = [pick.providerNames[0]?.toLowerCase(), pick.year || null, pick.progress ? `s${pick.progress.season}` : pick.titleType === "movie" ? null : "series"].filter(Boolean).join(" · ");
  return (
    <div className={`flex items-center gap-5 border-t border-line py-4 ${last ? "border-b" : ""}`}>
      <button type="button" onClick={() => onSelectNode(pick.imdbId)} className="h-16 w-12 shrink-0 overflow-hidden rounded bg-white/[0.05] ring-1 ring-line hover:ring-accent/60" title={pick.name}>
        {pick.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pick.posterUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[20px] leading-[1.25] tracking-[-0.01em] text-ink-dim md:text-[22px]">
          <button type="button" onClick={() => onSelectNode(pick.imdbId)} className="font-semibold text-ink hover:underline decoration-accent/60 underline-offset-4">
            {pick.name}
          </button>
          {pick.kind === "continue" ? ", " : ". "}
          {pick.reason.text}
        </p>
        <p className="font-mono text-[11px] text-ink-faint">{meta}</p>
      </div>
      {pick.playUrl && pick.playLabel ? (
        <a href={pick.playUrl} target="_blank" rel="noopener" className="flex h-9 shrink-0 items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-black">
          {pick.playLabel}
        </a>
      ) : (
        <span className="font-mono text-[11px] text-ink-faint">not streaming</span>
      )}
      <button type="button" onClick={onLater} className="shrink-0 font-mono text-[11px] text-ink-faint hover:text-ink">
        later
      </button>
    </div>
  );
}
