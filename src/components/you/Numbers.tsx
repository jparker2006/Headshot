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
import { useMemo, useState } from "react";
import type { NumbersGenre, NumbersPerson } from "@/lib/taste/numbers";
import { barClass, barRank, barWidth, rowInk } from "./ledger";
import { useNumbers, type NumbersResponse } from "./useNumbers";
import { LOG_FILTERS, LOG_PAGE, logDate, matchesLog, posterThumb, type LogFilter } from "./numbersRules";

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
          <LogTable data={data} onSelectNode={onSelectNode} />
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

// ---- the log table ---------------------------------------------------------

type SortKey = "watched" | "title" | "year";

const TABLE_COLS =
  "grid-cols-[minmax(0,1fr)_64px] sm:grid-cols-[96px_26px_minmax(0,360px)_48px_64px_96px_minmax(0,1fr)] sm:gap-[16px]";

function LogTable({ data, onSelectNode }: { data: NumbersResponse; onSelectNode: (imdbId: string) => void }) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(LOG_PAGE);
  const [sort, setSort] = useState<SortKey>("watched");

  const rows = useMemo(() => {
    const kept = data.log.filter((r) => matchesLog(r, filter, query));
    if (sort === "title") return [...kept].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "year") return [...kept].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    return kept;
  }, [data.log, filter, query, sort]);

  const head = (key: SortKey, label: string) => (
    <button type="button" onClick={() => setSort(key)} className={`text-left text-[13px] ${sort === key ? "text-ink" : "text-ink-faint hover:text-ink"}`}>
      {label}
      {sort === key && <span className="t-meta ml-1 text-ink-faint">↓</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-[10px]">
      <span className="t-sub">the log</span>

      <div className="flex flex-wrap items-center gap-[9px]">
        {LOG_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
              setLimit(LOG_PAGE);
            }}
            className={`chip ${filter === f ? "bg-raised text-ink" : ""}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex h-[46px] items-center gap-[12px] border-b border-[color:var(--line-input)]">
        <span className="tnum text-[15px] leading-none text-ink-ghost">&gt;</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(LOG_PAGE);
          }}
          aria-label="find a title in the log"
          placeholder="find a title"
          className="t-input min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-ghost"
        />
        <span className="t-meta ml-auto shrink-0">
          {data.log.length} rows · {rows.length} shown
        </span>
      </div>

      <div className="scrollbar-thin overflow-x-auto">
        <div className="min-w-[720px] sm:min-w-0">
          <div className={`grid h-[24px] items-center border-b border-line ${TABLE_COLS}`}>
            <span className="hidden sm:block">{head("watched", "watched")}</span>
            <span className="hidden sm:block" />
            <span>{head("title", "title")}</span>
            <span className="hidden sm:block">{head("year", "year")}</span>
            <span className="t-sub hidden sm:block">bucket</span>
            <span className="t-sub hidden sm:block">source</span>
            <span className="t-sub hidden sm:block">what it was</span>
          </div>
          {rows.length === 0 ? (
            <p className="t-prose py-3">Nothing matches that.</p>
          ) : (
            rows.slice(0, limit).map((r) => (
              <button key={`${r.imdbId}-${r.season ?? 0}`} type="button" onClick={() => onSelectNode(r.imdbId)} className={`row w-full text-left ${TABLE_COLS}`}>
                <span className="t-meta hidden sm:block">{logDate(r.watchedAt)}</span>
                <span className="hidden sm:block">
                  {posterThumb(r.posterPath) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={posterThumb(r.posterPath)!} alt="" className="poster-mark" loading="lazy" />
                  ) : (
                    <span className="poster-mark" />
                  )}
                </span>
                <span className="t-row truncate">
                  {r.name}
                  {r.season ? <span className="t-meta ml-[6px] text-ink-faint">s{r.season}</span> : null}
                </span>
                <span className="t-meta hidden text-ink-faint sm:block">{r.year ?? ""}</span>
                <span className={`bucket ${r.rating === "liked" ? "bucket-on" : ""}`}>{r.rating}</span>
                <span className="t-meta hidden sm:block">{r.source}</span>
                <span className="t-meta hidden truncate sm:block">
                  {r.kind === "series" ? "show" : "film"}
                  {r.runtime ? ` · ${r.runtime}m` : ""}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {rows.length > limit && (
        <button type="button" onClick={() => setLimit((n) => n + LOG_PAGE)} className="t-link self-start">
          {rows.length - limit} more
        </button>
      )}
    </div>
  );
}
