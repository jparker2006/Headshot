"use client";
/**
 * Tonight, drawn to board C: a section header, then 68px rows of
 * `34px | reason | 178px` — a 34×51 poster mark, one graph reason with its
 * names linked over a mono `2012 · 165m · hbo max` line, and the button.
 *
 * The first pick's button is `.btn-play`; the second and third are
 * `.btn-quiet`, because a screen gets exactly one amber thing
 * (`design/handoff-C.md` rule 4). Data comes from /api/tonight; nothing here
 * computes a pick, and every pick carries exactly one reason or it is not
 * drawn.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import type { TonightData, PickView } from "@/lib/picks/view";
import { lookupName } from "@/components/chat/lookup";

interface Props {
  /** Open a person or title in the drawer. */
  onSelectNode: (imdbId: string) => void;
  /** Post a question into the chat ("something funnier, under 40 minutes"). */
  onAsk?: (text: string) => void;
  /** Called when the user puts a pick off. */
  onLater?: (imdbId: string) => void;
  /** How many picks show before the caret. You shows one; a thread shows all. */
  initial?: number;
}

type State =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "empty" }
  | { status: "ready"; data: TonightData }
  | { status: "error"; message: string };

export function useTonight(): [State, () => void] {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    fetch("/api/tonight", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) return { status: "signed-out" } as State;
        if (r.status === 404) return { status: "empty" } as State;
        if (!r.ok) return { status: "error", message: `tonight is unavailable (${r.status})` } as State;
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

export function TonightPanel({ onSelectNode, onAsk, onLater, initial = 1 }: Props) {
  const [state, refresh] = useTonight();
  const [later, setLater] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const [looking, setLooking] = useState(false);

  const lookNow = async () => {
    setLooking(true);
    try {
      await fetch("/api/tonight/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    } catch {
      /* best effort; the state below says what happened */
    } finally {
      setLooking(false);
      refresh();
    }
  };

  const picks = state.status === "ready" ? state.data.picks.filter((p) => !later.has(p.imdbId)) : [];
  const shown = open ? picks : picks.slice(0, initial);

  return (
    <section className="flex flex-col gap-[12px]" aria-label="Tonight">
      <div className="section-head">
        <h2 className="t-title">tonight</h2>
        {picks.length > 0 && (
          <span className="t-meta">
            {picks.length} pick{picks.length === 1 ? "" : "s"}
            {picks.every((p) => p.onYourServices) ? " · all already paid for" : ""}
          </span>
        )}
      </div>

      {state.status === "loading" && <p className="t-meta">finding one for tonight…</p>}

      {state.status === "signed-out" && (
        <div className="flex flex-col items-start gap-[12px]">
          <p className="t-prose">three picks for tonight, on the services you already pay for.</p>
          <Link href="/auth/sign-in?next=/" className="btn btn-quiet">
            Sign in
          </Link>
        </div>
      )}

      {state.status === "error" && (
        <p className="t-prose">
          {state.message}.{" "}
          <button type="button" onClick={refresh} className="t-link">
            try again
          </button>
        </p>
      )}

      {(state.status === "empty" || (state.status === "ready" && picks.length === 0)) && (
        <p className="t-prose">
          nothing for tonight yet. log a few things, then{" "}
          <button type="button" onClick={() => void lookNow()} disabled={looking} className="t-link disabled:opacity-40">
            {looking ? "looking…" : "look now"}
          </button>
          .
        </p>
      )}

      {shown.length > 0 && (
        <div className="rise flex flex-col">
          {shown.map((p, i) => (
            <PickRow
              key={p.imdbId}
              pick={p}
              accent={i === 0}
              onSelectNode={onSelectNode}
              onLater={
                onLater
                  ? () => {
                      setLater((s) => new Set(s).add(p.imdbId));
                      onLater(p.imdbId);
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-[16px]">
        {picks.length > initial && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="t-link">
            {open ? "just the first one ⌃" : `show all ${picks.length} ⌄`}
          </button>
        )}
        {onAsk && picks.length > 0 && (
          <button type="button" onClick={() => onAsk("something funnier, under 40 minutes")} className="t-link">
            none of these? say what you are in the mood for
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * One pick. On a phone it stops being a row and becomes a block: poster and
 * reason on top, the button full width underneath (DESIGN.md → Rhythm).
 */
export function PickRow({
  pick,
  accent,
  onSelectNode,
  onLater,
}: {
  pick: PickView;
  accent: boolean;
  onSelectNode: (id: string) => void;
  onLater?: () => void;
}) {
  const meta = [
    pick.year || null,
    pick.progress ? `s${pick.progress.season}` : pick.titleType === "movie" ? null : "show",
    pick.providerNames[0]?.toLowerCase() ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  // The button column is a fixed 178px, and "Play on Amazon Prime Video" wraps
  // to two lines inside a 44px button there. The service is already on the mono
  // line under the reason, so on the row a long label falls back to the verb;
  // the phone block, which is full width, keeps the whole thing.
  const long = (pick.playLabel?.length ?? 0) > 16;

  const play = pick.playUrl && pick.playLabel ? (
    <a href={pick.playUrl} target="_blank" rel="noopener" className={`btn w-full whitespace-nowrap ${accent ? "btn-play" : "btn-quiet"}`}>
      <span className={long ? "sm:hidden" : undefined}>{pick.playLabel}</span>
      {long && <span className="hidden sm:inline">Play</span>}
    </a>
  ) : (
    <span className="t-meta">not streaming</span>
  );

  return (
    <div className="row row-tall h-auto grid-cols-[34px_minmax(0,1fr)] gap-x-[18px] gap-y-[10px] py-[12px] sm:h-[68px] sm:grid-cols-[34px_minmax(0,1fr)_178px] sm:py-0">
      <button type="button" onClick={() => onSelectNode(pick.imdbId)} aria-label={pick.name} className="self-center">
        {pick.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pick.posterUrl} alt="" className="poster-mark poster-mark-lg" />
        ) : (
          <span className="poster-mark poster-mark-lg" />
        )}
      </button>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <p className="t-reason">
          <button type="button" onClick={() => onSelectNode(pick.imdbId)} className="entity-link">
            {pick.name}
          </button>
          {pick.kind === "continue" ? ", " : ". "}
          <ReasonLine text={pick.reason.text} onSelectNode={onSelectNode} />
        </p>
        <span className="t-meta">{meta}</span>
      </div>
      <div className="col-span-2 flex items-center gap-[14px] sm:col-span-1">
        {play}
        {onLater && (
          <button type="button" onClick={onLater} className="t-link shrink-0 sm:hidden">
            later
          </button>
        )}
      </div>
    </div>
  );
}

/** The reason with its **names** as links: the cursor-for-movies rule applies here too. */
export function ReasonLine({ text, onSelectNode }: { text: string; onSelectNode: (id: string) => void }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") ? (
          <button key={i} type="button" className="entity-link" onClick={() => void lookupName(part.slice(2, -2)).then((id) => id && onSelectNode(id))}>
            {part.slice(2, -2)}
          </button>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
