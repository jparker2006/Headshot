"use client";
/**
 * Later: the titles you said "not tonight" to and your imported watchlist.
 * The recently-logged row form with the time gutter saying when it was added
 * instead of when it was logged (DESIGN.md → You → Services, imports, later).
 * Tonight draws from this list first.
 */
import { useEffect, useState } from "react";
import { useImages } from "@/components/chat/useImages";
import { useNames } from "@/components/chat/useNames";
import { terseTime } from "@/components/you/recent";

interface Row {
  titleImdbId: string;
  rating: string;
  updatedAt: string;
}

interface Props {
  onSelectNode: (imdbId: string) => void;
}

export function LaterPanel({ onSelectNode }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [gone, setGone] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch("/api/taste/watched", { cache: "no-store" });
      if (!r.ok) {
        if (alive) setRows([]);
        return;
      }
      const { watched } = (await r.json()) as { watched: Row[] };
      const want = watched.filter((w) => w.rating === "want").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      if (alive) setRows(want);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const kept = (rows ?? []).filter((r) => !gone.has(r.titleImdbId));
  const ids = kept.map((r) => r.titleImdbId);
  const images = useImages(ids);
  const names = useNames(ids);

  const act = (imdbId: string, rating: "liked" | "unseen") => {
    setGone((g) => new Set(g).add(imdbId));
    void fetch("/api/taste/swipe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: [{ imdbId, rating }] }) }).catch(() => {});
  };

  return (
    <section className="flex flex-col gap-[12px]" aria-label="Later">
      <div className="section-head">
        <h2 className="t-title">later</h2>
        {ids.length > 0 && <span className="t-meta">{ids.length} saved · tonight draws from here first</span>}
      </div>

      {rows === null && <p className="t-meta">reading later…</p>}
      {rows !== null && ids.length === 0 && (
        <p className="t-prose">nothing saved. put a pick off, or import a watchlist, and it lands here.</p>
      )}

      <div className="flex flex-col">
        {kept.map((row) => {
          const id = row.titleImdbId;
          return (
            <div
              key={id}
              className="row h-[52px] grid-cols-[26px_minmax(0,1fr)_auto] sm:h-[38px] sm:grid-cols-[88px_26px_minmax(0,320px)_48px_minmax(0,1fr)]"
            >
              <span className="t-meta hidden sm:block">added {terseTime(row.updatedAt)}</span>
              <button type="button" onClick={() => onSelectNode(id)} aria-label={names[id]?.name ?? id}>
                {images[id]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[id]!.url!} alt="" className="poster-mark" loading="lazy" />
                ) : (
                  <span className="poster-mark" />
                )}
              </button>
              <button type="button" onClick={() => onSelectNode(id)} className="min-w-0 text-left">
                <span className="t-row block truncate">
                  {names[id]?.name ?? "…"}
                  {/* the phone row is two lines, year on the first: same shape as recently logged */}
                  {names[id]?.year ? <span className="t-meta ml-[6px] text-ink-faint sm:hidden">{names[id]!.year}</span> : null}
                </span>
                <span className="t-meta block sm:hidden">added {terseTime(row.updatedAt)}</span>
              </button>
              <span className="t-meta hidden text-ink-faint sm:block">{names[id]?.year || ""}</span>
              <span className="flex items-center gap-[14px] justify-self-end">
                <button type="button" onClick={() => act(id, "liked")} className="t-link">
                  seen it
                </button>
                <button type="button" onClick={() => act(id, "unseen")} className="t-link">
                  remove
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
