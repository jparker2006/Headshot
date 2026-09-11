"use client";
import { useEffect, useState } from "react";
import { Markdown } from "@/components/chat/Markdown";

interface PageData {
  node: {
    imdbId: string;
    name: string;
    kind: "person" | "title";
    titleType: string;
    year: number;
    votes: number;
    genres: string;
    inIndustryGraph: boolean;
    inBrain: boolean;
    posterUrl?: string;
    knownAs?: string;
    degree: number;
  };
  page: { body: string; updatedAt: string; revisions: { at: string; question: string }[] } | null;
  neighbors: { imdbId: string; name: string; kind: string; titleType: string; year: number; tier: number }[];
}

interface Props {
  imdbId: string;
  onClose: () => void;
  onSelectNode: (imdbId: string) => void;
  onAsk: (text: string) => void;
  onExpand: (imdbId: string) => void;
}

export function PagePanel({ imdbId, onClose, onSelectNode, onAsk, onExpand }: Props) {
  const [data, setData] = useState<PageData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // The parent keys this panel by imdbId, so state resets on every new node.
  useEffect(() => {
    let alive = true;
    fetch(`/api/page/${imdbId}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error ?? r.statusText))))
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [imdbId]);

  return (
    <aside className="panel pointer-events-auto flex h-full w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden" aria-label="Page">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-ink-dim">
            {data ? (data.node.kind === "person" ? "Person" : data.node.titleType || "Title") : "Loading"}
            {data?.node.year ? ` · ${data.node.year}` : ""}
          </div>
          <h2 className="truncate text-[17px] font-semibold text-ink">{data?.node.name ?? "…"}</h2>
        </div>
        <button onClick={onClose} className="rounded-md px-2 py-1 text-[12px] text-ink-dim hover:bg-white/5 hover:text-ink" aria-label="Close">
          Close
        </button>
      </header>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {err && <p className="text-[13px] text-danger">{err}</p>}
        {data && (
          <>
            <div className="flex gap-3">
              {data.node.posterUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.node.posterUrl} alt="" className="h-28 w-20 rounded-md object-cover ring-1 ring-line" />
              )}
              <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
                <dt className="text-ink-dim">Credits</dt>
                <dd className="text-ink">{data.node.degree}</dd>
                {data.node.votes > 0 && (
                  <>
                    <dt className="text-ink-dim">IMDb votes</dt>
                    <dd className="text-ink">{data.node.votes.toLocaleString()}</dd>
                  </>
                )}
                {data.node.genres && (
                  <>
                    <dt className="text-ink-dim">Genres</dt>
                    <dd className="text-ink">{data.node.genres.split(",").join(", ")}</dd>
                  </>
                )}
                <dt className="text-ink-dim">Source</dt>
                <dd className="text-ink">{data.node.inIndustryGraph ? "Industry graph" : "Live (TMDB)"}</dd>
              </dl>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onAsk(`Tell me about ${data.node.name} and who they're most connected to.`)}
                className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-black"
              >
                Ask about this
              </button>
              <button onClick={() => onExpand(imdbId)} className="rounded-lg px-3 py-1.5 text-[12.5px] text-ink ring-1 ring-line hover:bg-white/5">
                Expand
              </button>
            </div>

            <section>
              <h3 className="mb-1.5 text-[11px] uppercase tracking-wider text-ink-dim">Brain page</h3>
              {data.page ? (
                <Markdown text={data.page.body} />
              ) : (
                <p className="text-[13px] text-ink-faint">Nothing written yet. Ask a question that touches this and the agent will start a page.</p>
              )}
            </section>

            {data.page && data.page.revisions.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[11px] uppercase tracking-wider text-ink-dim">Learned from</h3>
                <ul className="space-y-1">
                  {[...data.page.revisions].reverse().slice(0, 6).map((r, i) => (
                    <li key={i} className="text-[12px] text-ink-dim">
                      <span className="text-ink-faint">{new Date(r.at).toLocaleDateString()}</span> · “{r.question}”
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.neighbors.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[11px] uppercase tracking-wider text-ink-dim">
                  {data.node.kind === "person" ? "Credits" : "Cast & crew"}
                </h3>
                <ul className="space-y-0.5">
                  {data.neighbors.map((n) => (
                    <li key={n.imdbId}>
                      <button onClick={() => onSelectNode(n.imdbId)} className="flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left text-[13px] hover:bg-white/5">
                        <span className={n.kind === "title" ? "text-title" : "text-ink"}>{n.name}</span>
                        <span className="shrink-0 text-[11px] text-ink-faint">
                          {n.year || ""}
                          {n.tier === 0 ? " · weak" : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
