"use client";
/**
 * Numbers — the ledger (SPEC v4, story 64), drawn to board C.
 *
 * Every figure is a row: a Geist label, a mono figure, a bar whose width is
 * the datum and whose alpha is its rank. No tiles, no headline numbers, no
 * chart library and no SVG — `design/handoff-C.md` rule 2. The You page shows
 * the three blocks the board shows; `all of it` opens the rest (by month,
 * genres, runtime, the whole log table) in place, since Numbers has no page of
 * its own to link to.
 *
 * One GET of `/api/taste/numbers` computes all of it server-side; this
 * component draws, it never counts.
 */
import { useState } from "react";
import type { NumbersGenre, NumbersPerson } from "@/lib/taste/numbers";
import { barClass, barRank, barWidth, rowInk } from "./ledger";
import { useNumbers, type NumbersResponse } from "./useNumbers";
import { LogTable } from "@/components/log/LogTable";

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** The totals as one sentence, the way a person would say them out loud. */
export function totalsSentence(d: NumbersResponse): string {
  const t = d.totals;
  return `${plural(t.titles, "title")}, ${plural(t.films, "film")} and ${plural(t.shows, "show")}, about ${plural(t.hours, "hour")}, ${t.liked.toLocaleString()} liked.`;
}

const ROLE_LABEL: Record<NumbersPerson["role"], string> = {
  actor: "actor",
  director: "director",
  writer: "writer",
  other: "credit",
};

/** "2026-03" → "mar 26"; mono, because a month in a ledger is a figure. */
function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  const name = ["", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"][Number(m)] ?? month;
  return `${name} ${year.slice(2)}`;
}

interface LedgerRow {
  key: string;
  label: string;
  /** Decades and months are figures, so their label is mono too. */
  mono?: boolean;
  value: number;
  /** Replaces the bar on the last row of a block when the board says a figure instead. */
  aside?: string;
}

function Block({ label, rows, max, className = "" }: { label: string; rows: LedgerRow[]; max?: number; className?: string }) {
  if (rows.length === 0) return null;
  const peak = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className={`flex flex-col gap-[7px] ${className}`}>
      <span className="t-sub">{label}</span>
      {rows.map((r, i) => (
        <div key={r.key} className="row row-fig grid-cols-[88px_44px_minmax(0,1fr)] sm:grid-cols-[108px_52px_minmax(0,1fr)]">
          <span className={`truncate text-[13.5px] ${r.mono ? "tnum" : ""} ${rowInk(i, rows.length)}`}>{r.label}</span>
          <span className={`tnum text-[13.5px] leading-[1.2] ${rowInk(i, rows.length)}`}>{r.value.toLocaleString()}</span>
          {r.aside ? (
            <span className="t-meta truncate">{r.aside}</span>
          ) : (
            <span className={barClass(barRank(i, rows.length))} style={{ width: barWidth(r.value, peak) }} />
          )}
        </div>
      ))}
    </div>
  );
}

interface NumbersProps {
  onSelectNode: (imdbId: string) => void;
  /** Bumped when the log changes, so the ledger re-counts. */
  version?: number;
  /** `all of it` can be driven from outside (You's "the whole log" link). */
  open?: boolean;
  onToggle?: () => void;
}

export function Numbers({ onSelectNode, version = 0, open, onToggle }: NumbersProps) {
  const state = useNumbers(version);
  const [ownAll, setOwnAll] = useState(false);
  const all = open ?? ownAll;
  const toggle = onToggle ?? (() => setOwnAll((v) => !v));

  if (state.status === "loading") return <p className="t-meta">counting…</p>;
  if (state.status === "signed-out") return <p className="t-prose">Sign in to see your numbers.</p>;
  if (state.status === "error") return <p className="t-prose">Numbers are not answering right now.</p>;
  const data = state.data;
  if (data.totals.titles === 0) return <p className="t-prose">Log a few things and this fills in.</p>;

  const t = data.totals;
  const watched: LedgerRow[] = [
    { key: "films", label: "films", value: t.films },
    { key: "shows", label: "shows", value: t.shows },
    { key: "liked", label: "liked", value: t.liked },
    {
      key: "hours",
      label: "hours",
      value: t.hours,
      aside: `${t.seen + t.liked + t.meh} finished end to end · tv is ${Math.round((t.shows / Math.max(1, t.titles)) * 100)}% of what you log`,
    },
  ];
  const decades: LedgerRow[] = data.decades.slice(0, 6).map((d) => ({ key: d.decade, label: d.decade, mono: true, value: d.count }));

  return (
    <section className="flex flex-col gap-[14px]" aria-label="Numbers">
      <div className="section-head">
        <h2 className="t-title">numbers</h2>
        <span className="t-sub hidden sm:inline">everything Letterboxd never gave you</span>
        <button type="button" onClick={toggle} className="t-link ml-auto shrink-0">
          {all ? "just the ledger" : "all of it"}
        </button>
      </div>

      <p className="t-prose max-w-[880px]">{totalsSentence(data)}</p>

      <div className="grid grid-cols-1 gap-[28px] lg:grid-cols-2 lg:gap-x-[56px]">
        <Block label="what you have watched" rows={watched} max={Math.max(t.films, t.shows, t.liked)} />
        <Block label="by decade" rows={decades} />
        {data.people.length > 0 && <PeopleBlock people={data.people} onSelectNode={onSelectNode} className="lg:col-span-2" />}
      </div>

      {all && (
        <div className="mt-[24px] flex flex-col gap-[28px]">
          <Block
            label="by month"
            rows={data.months.slice(-12).map((m) => ({ key: m.month, label: monthLabel(m.month), mono: true, value: m.films + m.shows, aside: undefined }))}
          />
          {data.undated > 0 && (
            <p className="t-prose">
              {plural(data.undated, "watch", "watches")} with no date, so {data.undated === 1 ? "it sits" : "they sit"} outside the months above.
            </p>
          )}
          {data.genres.length > 0 && <GenreBlock genres={data.genres} />}
          <p className="t-prose">
            {data.runtimeFinished === null ? "Not enough runtimes yet to say how long a film you finish runs." : `The average film you finish runs ${data.runtimeFinished} minutes.`}
          </p>
          <LogTable rows={data.log} onSelectNode={onSelectNode} heading="the log" />
        </div>
      )}
    </section>
  );
}

// ---- who you keep watching -------------------------------------------------

/**
 * The board's four-column people ledger, with the 22px face marker the Numbers
 * brief asks for in front of each name. The role is Geist, not mono: mono is
 * figures only (`design/handoff-C.md` rule 3).
 */
function PeopleBlock({
  people,
  onSelectNode,
  className = "",
}: {
  people: (NumbersPerson & { face: string | null })[];
  onSelectNode: (imdbId: string) => void;
  className?: string;
}) {
  const peak = Math.max(...people.map((p) => p.count), 1);
  return (
    <div className={`flex flex-col gap-[7px] ${className}`}>
      <span className="t-sub">who you keep watching</span>
      <div className="grid grid-cols-1 gap-x-[40px] gap-y-[6px] sm:grid-cols-2 xl:grid-cols-4">
        {people.map((p, i) => (
          <button
            key={p.imdbId}
            type="button"
            onClick={() => onSelectNode(p.imdbId)}
            className="row row-fig grid-cols-[22px_minmax(0,1fr)_30px_72px] gap-[10px] text-left"
          >
            {p.face ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.face} alt="" className="h-[22px] w-[22px] bg-raised object-cover" loading="lazy" />
            ) : (
              <span className="block h-[22px] w-[22px] bg-raised" />
            )}
            <span className={`truncate text-[13.5px] ${rowInk(i, people.length)}`}>
              {p.name} <span className="text-[12.5px] text-ink-ghost">{ROLE_LABEL[p.role]}</span>
            </span>
            <span className={`tnum text-[13.5px] leading-[1.2] ${rowInk(i, people.length)}`}>{p.count}</span>
            <span className={barClass(barRank(i, people.length))} style={{ width: barWidth(p.count, peak) }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- genres ----------------------------------------------------------------

/** Liked over meh: two bars in one row, strong over weak. Never two colours. */
function GenreBlock({ genres }: { genres: NumbersGenre[] }) {
  const rows = genres.slice(0, 10);
  const peak = Math.max(...rows.map((g) => g.liked + g.meh + g.seen), 1);
  return (
    <div className="flex flex-col gap-[7px]">
      <span className="t-sub">genres, liked against meh</span>
      {rows.map((g) => (
        <div key={g.genre} className="row row-fig h-[28px] grid-cols-[88px_64px_minmax(0,1fr)] sm:grid-cols-[108px_64px_minmax(0,1fr)]">
          <span className="truncate text-[13.5px] text-ink">{g.genre}</span>
          <span className="tnum text-[13.5px] leading-[1.2] text-ink-dim">
            {g.liked} <span className="text-ink-ghost">·</span> {g.meh}
          </span>
          <span className="flex flex-col gap-[2px]">
            <span className="ledger-bar ledger-bar-strong" style={{ width: barWidth(g.liked, peak) }} />
            <span className="ledger-bar ledger-bar-weak" style={{ width: barWidth(g.meh, peak) }} />
          </span>
        </div>
      ))}
    </div>
  );
}
