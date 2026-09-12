"use client";
/**
 * The log itself (SPEC v5 → Log page; `design/boards-v5/Log.dc.html`): poster
 * mark, title, year, kind, score, date, runtime — newest first, filterable by
 * state and kind and by a line of text, a hundred rows at a time.
 *
 * It draws; it never counts. The rows arrive computed from
 * `/api/taste/numbers` and the only rules it applies are the pure ones in
 * `numbersRules.ts`. Rows carry no rule between them (handoff-C rule 1); the
 * one hairline is under the section header.
 */
import { useMemo, useState } from "react";
import type { NumbersLogRow } from "@/lib/taste/numbers";
import { LOG_FILTERS, LOG_PAGE, matchesLog, posterThumb, type LogFilter } from "@/components/you/numbersRules";
import { terseTime } from "@/components/you/recent";
import { isFigureWord, ratingWord } from "./scoreRules";

/** The board's seven columns; on a phone every row folds into two lines. */
const COLS =
  "grid-cols-[26px_minmax(0,1fr)_40px] gap-[12px] sm:grid-cols-[26px_minmax(0,340px)_48px_58px_48px_76px_minmax(0,1fr)] sm:gap-[16px]";

interface Props {
  rows: NumbersLogRow[];
  onSelectNode: (imdbId: string) => void;
  /** The heading over the table. */
  heading?: string;
  /** Offered as "Catch up" — in the header on a phone, beside the chips on a laptop. */
  onCatchUp?: () => void;
}

export function LogTable({ rows, onSelectNode, heading = "everything you have watched", onCatchUp }: Props) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(LOG_PAGE);

  // Newest first is the order the log is read in; the route already sorts, so
  // this only filters.
  const kept = useMemo(() => rows.filter((r) => matchesLog(r, filter, query)), [rows, filter, query]);
  const shown = kept.slice(0, limit);

  return (
    <section className="flex flex-col gap-[12px]" aria-label="the log">
      <div className="section-head">
        {/* the phone board titles it `your log`: the long sentence would take two lines */}
        <h2 className="t-title">
          <span className="sm:hidden" aria-hidden>your log</span>
          <span className="hidden sm:inline">{heading}</span>
        </h2>
        <span className="t-meta">
          {rows.length} rows<span className="hidden sm:inline"> · {kept.length} shown</span>
        </span>
        {onCatchUp && (
          <button type="button" onClick={onCatchUp} className="t-link ml-auto sm:hidden">
            Catch up
          </button>
        )}
      </div>

      {/* the six chips are one line on the phone board too: they scroll inside
          their own strip rather than wrapping into a ragged block, and the
          find-a-title field takes the line under them. */}
      <div className="flex flex-col gap-[8px] sm:flex-row sm:flex-wrap sm:items-center">
        <div className="scrollbar-none -mx-[16px] flex gap-[8px] overflow-x-auto px-[16px] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {LOG_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                setLimit(LOG_PAGE);
              }}
              className={`chip shrink-0 ${filter === f ? "bg-raised text-ink" : ""}`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(LOG_PAGE);
          }}
          aria-label="find a title in the log"
          placeholder="find a title"
          className="h-[38px] min-w-0 flex-none border-b border-[color:var(--line-note)] bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-ghost sm:flex-1 sm:basis-[140px]"
        />
        {onCatchUp && (
          <button type="button" onClick={onCatchUp} className="btn btn-quiet ml-auto hidden shrink-0 sm:inline-flex">
            Catch up
          </button>
        )}
      </div>

      <div className="flex flex-col">
        <div className={`hidden h-[24px] items-center sm:grid ${COLS}`}>
          <span />
          <span className="t-sub">title</span>
          <span className="t-sub">year</span>
          <span className="t-sub">kind</span>
          <span className="t-sub">score</span>
          <span className="t-sub">logged</span>
          <span className="t-sub">runtime</span>
        </div>

        {shown.length === 0 ? (
          <p className="t-prose py-[10px]">Nothing matches that.</p>
        ) : (
          shown.map((r) => <Row key={`${r.imdbId}-${r.season ?? 0}`} row={r} onSelectNode={onSelectNode} />)
        )}
      </div>

      {kept.length > limit && (
        <button type="button" onClick={() => setLimit((n) => n + LOG_PAGE)} className="t-link self-start">
          show more · {kept.length - limit} left
        </button>
      )}
    </section>
  );
}

function Row({ row, onSelectNode }: { row: NumbersLogRow; onSelectNode: (imdbId: string) => void }) {
  const poster = posterThumb(row.posterPath);
  const word = ratingWord(row);
  const runtime = row.runtime ? `${row.runtime}m` : "";
  // A `want` was never watched, so it has no `watchedAt`; the day it went on
  // the list is still a date, and the board draws one on every row.
  const when = terseTime(row.watchedAt ?? row.addedAt);
  // A `want` row has not been watched, so it sits back a level — the board
  // dims both its poster and its title rather than colouring anything.
  const pending = row.state === "want" || row.state === "unseen";

  return (
    <button
      type="button"
      onClick={() => onSelectNode(row.imdbId)}
      className={`row h-[52px] w-full text-left sm:h-[38px] ${COLS}`}
    >
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" loading="lazy" className={`poster-mark ${pending ? "opacity-60" : ""}`} />
      ) : (
        <span className="poster-mark" />
      )}
      <span className="min-w-0">
        <span className={`t-row block truncate ${pending ? "text-ink-dim" : ""}`}>
          {row.name}
          {row.season ? <span className="t-meta ml-[6px] text-ink-faint">s{row.season}</span> : null}
          {row.year ? <span className="t-meta ml-[6px] text-ink-faint sm:hidden">{row.year}</span> : null}
        </span>
        {/* the phone's second line: the whole row as one mono readout — or the
            line the user wrote, which is worth more than the readout */}
        {row.note ? (
          <span className="block truncate text-[13px] leading-[1.3] text-ink-dim sm:hidden">“{row.note}”</span>
        ) : (
          <span className="t-meta block sm:hidden">
            {[when, row.kind === "series" ? "show" : "film", runtime].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      <span className="t-meta hidden text-ink-faint sm:block">{row.year ?? ""}</span>
      <span className="hidden text-[12.5px] leading-[1.2] text-ink-dim sm:block">{row.kind === "series" ? "show" : "film"}</span>
      <span
        className={
          isFigureWord(row)
            ? "tnum block text-right text-[13.5px] leading-[1.2] text-ink sm:text-left"
            : "block text-right text-[12.5px] leading-[1.2] text-ink-dim sm:text-left"
        }
      >
        {word}
      </span>
      <span className="t-meta hidden sm:block">{when}</span>
      {/* runtime, and after it the line the user wrote, quoted (the board's
          last column) */}
      <span className="hidden min-w-0 items-baseline gap-[10px] sm:flex">
        {/* a fixed slot, so the quotes below each other start on one line even
            where a row has no runtime to print */}
        <span className="t-meta w-[42px] flex-none">{runtime}</span>
        {row.note && <span className="truncate text-[13px] leading-[1.3] text-ink-dim">“{row.note}”</span>}
      </span>
    </button>
  );
}
