"use client";
/**
 * Identification candidates as faces. Two to eight thumb-sized cards with the
 * name and the matching credit. Tap → open the page, or continue the answer.
 */
import type { HeadshotDataParts } from "@/lib/agent/events";
import { useImages } from "./useImages";
import type { FaceTap } from "./faceGridRule";

interface Props {
  faces: HeadshotDataParts["faces"];
  tap: FaceTap;
  onSelectNode: (imdbId: string) => void;
  onAsk: (text: string) => void;
}

export function FaceGrid({ faces, tap, onSelectNode, onAsk }: Props) {
  const ids = faces.candidates.map((c) => c.imdbId);
  const images = useImages(ids);
  if (faces.candidates.length === 0) return null;
  return (
    <figure className="rise my-2" aria-label="Who do you mean?">
      <div className="mb-2 flex items-baseline justify-between text-[11px] uppercase tracking-wider text-ink-dim">
        <span>
          Who do you mean? <span className="text-ink">{faces.candidates.length}</span> {faces.candidates.length === 1 ? "match" : "matches"}
          {faces.total > faces.candidates.length && <span> of {faces.total}</span>}
        </span>
        <span className="normal-case tracking-normal text-ink-faint">{tap === "open" ? "tap to open" : "tap to continue"}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {faces.candidates.map((c) => {
          const url = images[c.imdbId]?.url ?? null;
          return (
            <button
              key={c.imdbId}
              type="button"
              onClick={() => (tap === "open" ? onSelectNode(c.imdbId) : onAsk(`I mean ${c.name}`))}
              className="group flex flex-col overflow-hidden rounded-xl bg-white/[0.04] text-left ring-1 ring-line transition hover:ring-accent/70"
              title={c.credit}
            >
              <div className="aspect-[3/4] w-full overflow-hidden bg-white/[0.05]">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[22px] font-semibold text-ink-faint">{initials(c.name)}</div>
                )}
              </div>
              <div className="px-2 py-1.5">
                <div className="truncate text-[12.5px] font-semibold text-ink">{c.name}</div>
                <div className="line-clamp-2 text-[11px] leading-snug text-ink-dim">{c.character ? `as ${c.character}` : c.credit}</div>
              </div>
            </button>
          );
        })}
      </div>
    </figure>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
