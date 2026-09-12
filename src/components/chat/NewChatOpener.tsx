"use client";
/**
 * A new chat opens with tonight's pick. One assistant row where every chat
 * product puts its greeting: the line the server wrote, the poster mark, one
 * Play, and a mono line under it (design/research-v5.md §10).
 *
 * It is a client-side empty state and nothing more — it is never sent as a
 * message, never stored, and it disappears the moment the thread has a turn.
 */
import { useEffect, useState } from "react";
import type { PickView } from "@/lib/picks/view";
import { Markdown } from "./Markdown";
import type { EntityIndex } from "./entityLinks";
import { openerCopy, openerMetaLine, openerPlay, type OpenerState } from "./opener";

interface Props {
  signedIn: boolean;
  onSelectNode: (imdbId: string) => void;
  onLookup: (name: string) => void;
}

interface OpenerData {
  pick: PickView;
  line: string;
}

export function NewChatOpener({ signedIn, onSelectNode, onLookup }: Props) {
  // The fetch's own result, nothing else: signed out there is no fetch and the
  // state is read straight off the session.
  const [found, setFound] = useState<{ done: boolean; data: OpenerData | null }>({ done: false, data: null });

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    fetch("/api/tonight/opener", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as OpenerData) : null))
      .then((d) => {
        if (alive) setFound({ done: true, data: d?.pick && d.line ? d : null });
      })
      .catch(() => {
        if (alive) setFound({ done: true, data: null });
      });
    return () => {
      alive = false;
    };
  }, [signedIn]);

  const state: OpenerState = !signedIn ? "signed-out" : !found.done ? "loading" : found.data ? "ready" : "none";

  if (state !== "ready" || !found.data) {
    return <p className={state === "loading" ? "t-meta self-start pl-[2px]" : "t-prose self-start pl-[2px]"}>{openerCopy(state === "ready" ? "none" : state)}</p>;
  }

  const { pick, line } = found.data;
  const entities: EntityIndex = new Map([[pick.name.toLowerCase(), { imdbId: pick.imdbId, name: pick.name, kind: "title" as const }]]);
  const play = openerPlay(pick);
  const meta = openerMetaLine(pick);

  return (
    <div className="rise flex flex-col items-start gap-[14px]">
      <div className="bubble bubble-them">
        <Markdown text={line} entities={entities} onSelectNode={onSelectNode} onLookup={onLookup} />
      </div>

      {/* Laptop: poster, Play and the mono line on one row. Phone: a block —
          poster and meta on top, Play full width (DESIGN.md → Phone). */}
      <div className="-mt-[2px] grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-[12px] gap-y-[10px] self-start pl-[2px] sm:flex sm:w-auto sm:gap-[16px]">
        <button type="button" onClick={() => onSelectNode(pick.imdbId)} aria-label={pick.name} className="shrink-0">
          {pick.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pick.posterUrl} alt="" className="poster-mark poster-mark-lg" />
          ) : (
            <span className="poster-mark poster-mark-lg" />
          )}
        </button>
        <span className="t-meta min-w-0 truncate sm:order-3 sm:whitespace-nowrap">{meta}</span>
        {play && (
          <a
            href={play.url}
            target="_blank"
            rel="noopener"
            className={`btn col-span-2 w-full justify-center whitespace-nowrap sm:order-2 sm:w-auto ${play.accent ? "btn-play" : "btn-quiet"}`}
          >
            {play.label}
          </a>
        )}
      </div>
    </div>
  );
}
