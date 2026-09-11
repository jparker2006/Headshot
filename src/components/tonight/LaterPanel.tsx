"use client";
/**
 * Later: the titles you said "not tonight" to and your imported watchlist.
 * A plain list with posters; tap opens the title, "seen it" and "remove"
 * write through the swipe route. The pick engine draws from this list first.
 */
import { useEffect, useState } from "react";
import { useImages } from "@/components/chat/useImages";

interface Row {
  titleImdbId: string;
  rating: string;
  updatedAt: string;
}
interface Named {
  imdbId: string;
  name: string;
  year: number;
}

interface Props {
  onSelectNode: (imdbId: string) => void;
}

export function LaterPanel({ onSelectNode }: Props) {
  const [rows, setRows] = useState<Named[] | null>(null);
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
      // Names and posters arrive through the hooks below; the list itself is just ids in order.
      if (alive) setRows(want.map((w) => ({ imdbId: w.titleImdbId, name: w.titleImdbId, year: 0 })));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const ids = (rows ?? []).map((r) => r.imdbId).filter((id) => !gone.has(id));
  const images = useImages(ids);
  const names = useNames(ids);

  const act = (imdbId: string, rating: "liked" | "meh" | "unseen") => {
    setGone((g) => new Set(g).add(imdbId));
    void fetch("/api/taste/swipe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: [{ imdbId, rating }] }) }).catch(() => {});
  };

  if (rows === null) return <p className="font-mono text-[11px] text-ink-faint">loading later…</p>;
  if (ids.length === 0)
    return (
      <div className="space-y-2">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Later</h1>
        <p className="text-[14px] text-ink-dim">Nothing saved. Tap “later” on a pick, or import your Letterboxd watchlist, and it lands here. Tonight draws from this list first.</p>
      </div>
    );
  return (
    <section className="space-y-4" aria-label="Later">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Later</h1>
        <span className="font-mono text-[11px] text-ink-faint">{ids.length} saved · tonight draws from here first</span>
      </div>
      <ul className="stagger divide-y divide-line">
        {ids.map((id) => (
          <li key={id} className="flex items-center gap-4 py-3">
            <button onClick={() => onSelectNode(id)} className="h-16 w-12 shrink-0 overflow-hidden rounded bg-white/[0.05] ring-1 ring-line hover:ring-accent/60">
              {images[id]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[id]!.url!} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : null}
            </button>
            <button onClick={() => onSelectNode(id)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[15px] font-medium text-ink">{names[id]?.name ?? "…"}</span>
              <span className="font-mono text-[11px] text-ink-faint">{names[id]?.year || ""}</span>
            </button>
            <button onClick={() => act(id, "liked")} className="font-mono text-[11px] text-ink-faint hover:text-ink">
              seen it, liked
            </button>
            <button onClick={() => act(id, "unseen")} className="font-mono text-[11px] text-ink-faint hover:text-ink">
              remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const nameCache = new Map<string, { name: string; year: number }>();
/** Title names and years for a list of ids, through /api/names, cached for the tab. */
function useNames(ids: string[]): Record<string, { name: string; year: number }> {
  const key = ids.join(",");
  const [names, setNames] = useState<Record<string, { name: string; year: number }>>({});
  useEffect(() => {
    const missing = key.split(",").filter((id) => id && !nameCache.has(id));
    if (missing.length === 0) return;
    let alive = true;
    fetch(`/api/names?ids=${missing.join(",")}`)
      .then((r) => r.json())
      .then((d: { names: Record<string, { name: string; year: number }> }) => {
        for (const [id, v] of Object.entries(d.names)) nameCache.set(id, v);
        if (alive) setNames((prev) => ({ ...prev, ...d.names }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  const out: Record<string, { name: string; year: number }> = { ...names };
  for (const id of ids) {
    const c = nameCache.get(id);
    if (c && !out[id]) out[id] = c;
  }
  return out;
}
