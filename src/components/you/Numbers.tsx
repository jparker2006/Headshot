"use client";
/**
 * Numbers: the analytics Letterboxd never gave you (SPEC v4, story 64).
 *
 * Everything here comes from one GET of `/api/taste/numbers`, which computes
 * the whole page server-side — this component draws, it never counts. The
 * charts are hand-written SVG (no chart library, no model), and the markup is
 * kept plain and semantic on purpose: chunk C restyles it from the winning
 * design board.
 */
import { useEffect, useMemo, useState } from "react";
import type { NumbersData, NumbersPerson } from "@/lib/taste/numbers";
import { MonthsChart } from "./charts/MonthsChart";
import { DecadeBars } from "./charts/DecadeBars";
import { GenreBars } from "./charts/GenreBars";
import { LOG_FILTERS, LOG_PAGE, logDate, matchesLog, posterThumb, type LogFilter } from "./numbersRules";

/** The route's people carry the face it resolved for them. */
type PersonWithFace = NumbersPerson & { face: string | null };
interface NumbersResponse extends Omit<NumbersData, "people"> {
  people: PersonWithFace[];
}

type State = { status: "loading" } | { status: "signed-out" } | { status: "error" } | { status: "ready"; data: NumbersResponse };

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** The totals as one sentence, the way a person would say it out loud. */
function totalsSentence(d: NumbersResponse): string {
  const t = d.totals;
  const parts = [
    plural(t.titles, "title"),
    `${plural(t.films, "film")} and ${plural(t.shows, "show")}`,
    `about ${plural(t.hours, "hour")}`,
    `${t.liked.toLocaleString()} liked`,
  ];
  return `${parts.join(", ")}.`;
}

const ROLE_LABEL: Record<NumbersPerson["role"], string> = {
  actor: "actor",
  director: "director",
  writer: "writer",
  other: "credit",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function Numbers({ onSelectNode }: { onSelectNode: (imdbId: string) => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [filter, setFilter] = useState<LogFilter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(LOG_PAGE);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/taste/numbers", { cache: "no-store" });
        if (!alive) return;
        if (res.status === 401) return setState({ status: "signed-out" });
        if (!res.ok) return setState({ status: "error" });
        setState({ status: "ready", data: (await res.json()) as NumbersResponse });
      } catch {
        if (alive) setState({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const data = state.status === "ready" ? state.data : null;
  const rows = useMemo(() => (data ? data.log.filter((r) => matchesLog(r, filter, query)) : []), [data, filter, query]);

  if (state.status === "loading") return <p className="text-[13px] text-ink-faint">counting…</p>;
  if (state.status === "signed-out") return <p className="text-[14px] text-ink-dim">Sign in to see your numbers.</p>;
  if (state.status === "error") return <p className="text-[14px] text-ink-dim">Numbers are not answering right now.</p>;
  if (!data || data.totals.titles === 0) return <p className="text-[14px] text-ink-dim">Log a few things and this fills in.</p>;

  return (
    <div className="space-y-10" aria-label="Numbers">
      <Section title="Totals">
        <p className="text-[15px] text-ink">{totalsSentence(data)}</p>
        {data.undated > 0 && (
          <p className="text-[13px] text-ink-faint">
            {plural(data.undated, "watch", "watches")} with no date, so {data.undated === 1 ? "it sits" : "they sit"} outside the months below.
          </p>
        )}
      </Section>

      <Section title="By month">
        <MonthsChart months={data.months} />
      </Section>

      {data.people.length > 0 && (
        <Section title="People">
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {data.people.map((p) => (
              <li key={p.imdbId}>
                <button type="button" onClick={() => onSelectNode(p.imdbId)} className="w-full text-left hover:text-accent">
                  {p.face ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.face} alt="" className="aspect-[3/4] w-full rounded-panel object-cover" />
                  ) : (
                    <span className="flex aspect-[3/4] w-full items-center justify-center rounded-panel bg-raised text-[15px] text-ink-faint">
                      {p.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="mt-1.5 block truncate text-[13px] text-ink">{p.name}</span>
                  <span className="block text-[11.5px] text-ink-faint">
                    {p.count} · {ROLE_LABEL[p.role]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.decades.length > 0 && (
        <Section title="Decades">
          <DecadeBars decades={data.decades} />
        </Section>
      )}

      <Section title="Runtime you finish">
        <p className="text-[15px] text-ink">
          {data.runtimeFinished === null
            ? "Not enough runtimes yet to say."
            : `The average film you finish runs ${data.runtimeFinished} minutes.`}
        </p>
      </Section>

      {data.genres.length > 0 && (
        <Section title="Genres">
          <GenreBars genres={data.genres} />
        </Section>
      )}

      <Section title="The log">
        <div className="flex flex-wrap items-center gap-2">
          {LOG_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                setLimit(LOG_PAGE);
              }}
              className={`h-8 rounded-full px-3 text-[12.5px] capitalize ${
                filter === f ? "bg-accent font-semibold text-black" : "border border-line text-ink-dim hover:text-ink"
              }`}
            >
              {f}
            </button>
          ))}
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(LOG_PAGE);
            }}
            placeholder="find a title"
            aria-label="find a title in the log"
            className="h-8 min-w-40 flex-1 rounded-panel border border-line bg-raised px-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
          />
        </div>

        {rows.length === 0 ? (
          <p className="text-[13.5px] text-ink-dim">Nothing matches that.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13.5px]">
              <thead className="text-[12px] text-ink-faint">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 font-normal">
                    <span className="sr-only">Poster</span>
                  </th>
                  <th scope="col" className="py-2 font-normal">Title</th>
                  <th scope="col" className="py-2 font-normal">Kind</th>
                  <th scope="col" className="py-2 font-normal">Rating</th>
                  <th scope="col" className="py-2 font-normal">Watched</th>
                  <th scope="col" className="py-2 text-right font-normal">Runtime</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((r) => (
                  <tr key={r.imdbId} className="border-b border-line align-middle">
                    <td className="py-1.5 pr-3">
                      {posterThumb(r.posterPath) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={posterThumb(r.posterPath)!} alt="" className="h-12 w-8 rounded-sm object-cover" />
                      ) : (
                        <span className="block h-12 w-8 rounded-sm bg-raised" />
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      <button type="button" onClick={() => onSelectNode(r.imdbId)} className="text-left text-ink hover:text-accent">
                        {r.name}
                        {r.year ? <span className="text-ink-faint"> ({r.year})</span> : null}
                      </button>
                    </td>
                    <td className="py-1.5 pr-3 text-ink-dim">
                      {r.kind === "series" ? (r.season ? `show · s${r.season}` : "show") : "film"}
                    </td>
                    <td className="py-1.5 pr-3 text-ink-dim">{r.rating}</td>
                    <td className="py-1.5 pr-3 text-ink-dim">{logDate(r.watchedAt)}</td>
                    <td className="py-1.5 text-right text-ink-dim">{r.runtime ? `${r.runtime}m` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((n) => n + LOG_PAGE)}
            className="h-8 rounded-full border border-line px-3 text-[12.5px] text-ink-dim hover:text-ink"
          >
            Show more ({rows.length - limit} left)
          </button>
        )}
      </Section>
    </div>
  );
}
