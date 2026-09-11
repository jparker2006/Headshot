"use client";
/**
 * The path is the graphic. A left-to-right chain of headshots and posters
 * joined by arrows, with the tied alternatives stacked faintly beneath.
 */
import { useEffect, useState } from "react";
import type { HeadshotDataParts, NamedPath, PathsFound } from "@/lib/agent/events";

interface Props {
  paths: PathsFound;
  chosen: HeadshotDataParts["chosen"] | null;
  onSelectNode: (id: string) => void;
}

type ImageMap = Record<string, { url: string | null }>;
const imageCache = new Map<string, { url: string | null }>();

function useImages(ids: string[]): ImageMap {
  const key = ids.join(",");
  const [images, setImages] = useState<ImageMap>(() => Object.fromEntries(ids.filter((id) => imageCache.has(id)).map((id) => [id, imageCache.get(id)!])));
  useEffect(() => {
    const missing = key.split(",").filter((id) => id && !imageCache.has(id));
    if (missing.length === 0) return;
    let alive = true;
    fetch(`/api/enrich?ids=${missing.join(",")}`)
      .then((r) => r.json())
      .then((d: { images: ImageMap }) => {
        for (const [id, v] of Object.entries(d.images)) imageCache.set(id, v);
        if (alive) setImages((prev) => ({ ...prev, ...d.images }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  return images;
}

export function PathGraphic({ paths, chosen, onSelectNode }: Props) {
  const shortest = paths.full?.paths[0];
  const lit = chosen?.path ?? shortest;
  const alternates = [...(paths.strong?.paths ?? []), ...(paths.full?.paths ?? [])]
    .filter((p) => !lit || p.imdbIds.join() !== lit.imdbIds.join())
    .filter((p, i, arr) => arr.findIndex((q) => q.imdbIds.join() === p.imdbIds.join()) === i)
    .slice(0, 4);
  const ids = lit ? lit.imdbIds : [];
  const images = useImages(ids);

  if (!lit) {
    return <p className="text-[13px] text-ink-dim">No connection found in the graph.</p>;
  }
  const hops = lit.imdbIds.filter((id) => id.startsWith("tt")).length;

  return (
    <figure className="rise my-2">
      <div className="mb-2 flex items-baseline justify-between text-[11px] uppercase tracking-wider text-ink-dim">
        <span>
          <span className="text-ink">{paths.baconNumber}</span> {paths.baconNumber === 1 ? "degree" : "degrees"} apart
          {hops !== paths.baconNumber && <span> · shown route {hops} hops</span>}
        </span>
        <span>{paths.full?.paths.length ?? 0} tied</span>
      </div>

      <div className="scrollbar-thin overflow-x-auto">
        <div className="flex items-stretch gap-1.5 pb-1">
          {lit.imdbIds.map((id, i) => (
            <div key={id + i} className="flex items-center gap-1.5">
              {i > 0 && <Arrow />}
              <Card id={id} name={lit.names[i]} image={images[id]?.url} onClick={() => onSelectNode(id)} />
            </div>
          ))}
        </div>
      </div>

      {chosen?.reason && <figcaption className="mt-1.5 text-[12px] text-ink-dim">{chosen.reason}</figcaption>}

      {alternates.length > 0 && (
        <details className="mt-2 group">
          <summary className="cursor-pointer select-none text-[11.5px] uppercase tracking-wider text-ink-faint hover:text-ink-dim">
            {alternates.length} other {alternates.length === 1 ? "route" : "routes"}
          </summary>
          <ul className="mt-1.5 space-y-1">
            {alternates.map((p) => (
              <li key={p.imdbIds.join()}>
                <AltChain path={p} onSelectNode={onSelectNode} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </figure>
  );
}

function Card({ id, name, image, onClick }: { id: string; name: string; image?: string | null; onClick: () => void }) {
  const isTitle = id.startsWith("tt");
  return (
    <button onClick={onClick} className="group flex w-[104px] shrink-0 flex-col items-center gap-1.5 rounded-lg p-1 text-center hover:bg-white/[0.04]" title={name}>
      <div
        className={`relative h-[132px] w-[88px] overflow-hidden rounded-md ring-1 ring-line ${isTitle ? "bg-title/20" : "bg-person/10"} ${image === undefined ? "animate-pulse" : ""}`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[22px] font-semibold text-ink-faint">{initials(name)}</div>
        )}
        {isTitle && <span className="absolute inset-x-0 bottom-0 h-1 bg-title/80" />}
      </div>
      <span className={`line-clamp-2 text-[11.5px] leading-tight ${isTitle ? "text-title" : "text-ink"}`}>{name}</span>
    </button>
  );
}

function Arrow() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" className="shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 7h14M10 2l5 5-5 5" />
    </svg>
  );
}

function AltChain({ path, onSelectNode }: { path: NamedPath; onSelectNode: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] text-ink-dim">
      {path.names.map((n, i) => (
        <span key={path.imdbIds[i] + i} className="flex items-center gap-1">
          {i > 0 && <span className="text-ink-faint">→</span>}
          <button onClick={() => onSelectNode(path.imdbIds[i])} className={`hover:underline ${path.imdbIds[i].startsWith("tt") ? "text-title/80" : ""}`}>
            {n}
          </button>
        </span>
      ))}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
