"use client";
/**
 * The faces under an answer, in two shapes (SPEC v5 → Identification).
 *
 * `mode: "answer"` is the usual one: the description fit exactly one person,
 * so there is nothing to choose between and nothing to ask. It draws that one
 * person — a 30×45 headshot, the name, `as <character>` — and no header, no
 * count and no instruction, because a question with one answer is not a menu.
 *
 * `mode: "choose"` is the genuine tie: the row form the whole product speaks
 * in, one row per match, `{n} fit · tap one`. Only the matches are ever listed;
 * the cast is not a shortlist.
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

  if (faces.mode === "answer") {
    const c = faces.candidates[0];
    const url = images[c.imdbId]?.url ?? null;
    return (
      <figure className="rise m-0 flex items-center gap-[14px]">
        <button type="button" onClick={() => onSelectNode(c.imdbId)} aria-label={c.name} className="shrink-0">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="poster-mark poster-mark-md" loading="lazy" />
          ) : (
            <span className="poster-mark poster-mark-md flex items-center justify-center text-[11px] font-medium text-ink-faint">{initials(c.name)}</span>
          )}
        </button>
        <figcaption className="flex min-w-0 flex-col gap-[4px]">
          <button type="button" onClick={() => onSelectNode(c.imdbId)} className="t-row truncate text-left text-[16px] font-semibold">
            {c.name}
          </button>
          <span className="t-meta truncate">{c.character ? `as ${c.character}` : c.credit}</span>
        </figcaption>
      </figure>
    );
  }

  const n = faces.candidates.length;
  return (
    <figure className="rise m-0 flex flex-col" aria-label="Who do you mean?">
      <div className="flex items-baseline gap-[12px] pb-[6px]">
        <span className="t-sub">who do you mean?</span>
        <span className="t-meta">
          {n} fit · {tap === "open" ? "tap one" : "tap to continue"}
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
