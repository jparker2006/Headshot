"use client";
/**
 * Identification candidates, board C: not a grid of cards but the row form the
 * whole product speaks in — a 22px headshot marker, the name, and the credit
 * in mono. No ring, no card, no uppercase label. Tap opens the page or
 * continues the answer (`faceGridRule`).
 */
import type { HeadshotDataParts } from "@/lib/agent/events";
import { useImages } from "./useImages";
import type { FaceTap } from "./faceGridRule";
import { meanText } from "./faceGridRule";

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
  const n = faces.candidates.length;
  return (
    <figure className="rise m-0 flex flex-col" aria-label="Who do you mean?">
      <div className="flex items-baseline gap-[12px] pb-[6px]">
        <span className="t-sub">who do you mean?</span>
        <span className="t-meta">
          {n} {n === 1 ? "match" : "matches"}
          {faces.total > n && ` of ${faces.total}`} · {tap === "open" ? "tap to open" : "tap to continue"}
        </span>
      </div>
      <div className="flex flex-col">
        {faces.candidates.map((c) => {
          const url = images[c.imdbId]?.url ?? null;
          return (
            <button
              key={c.imdbId}
              type="button"
              onClick={() => (tap === "open" ? onSelectNode(c.imdbId) : onAsk(meanText(c.name)))}
              className="row w-full text-left"
              style={{ gridTemplateColumns: "26px minmax(0, 260px) minmax(0, 1fr)" }}
              title={c.credit}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="poster-mark" loading="lazy" />
              ) : (
                <span className="poster-mark flex items-center justify-center text-[10px] font-medium text-ink-faint">{initials(c.name)}</span>
              )}
              <span className="t-row truncate">{c.name}</span>
              <span className="t-meta truncate">{c.character ? `as ${c.character}` : c.credit}</span>
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
