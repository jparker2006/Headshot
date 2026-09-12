/**
 * Numbers: the analytics Letterboxd never gave you (SPEC v4, story 64),
 * computed from the user's `watched` rows, the `titles` cache and the
 * industry graph. Pure and deterministic — no network, no model and, since v5
 * dropped the month chart, no clock at all, so `tests/taste/numbers.test.ts`
 * can pin every figure to a fixture.
 *
 * v5 trimmed this to what the You page and the log table actually draw: the
 * totals behind the numbers sentence, the people row, the decades row and the
 * log rows. The per-month and per-genre charts are gone with the dashboard.
 *
 * Two rules run through the whole file:
 *   - `want` is not watching. A wanted row counts in the totals and shows up
 *     in the log, and is invisible to hours, people and decades.
 *   - `unseen` is the swipe's removal verb ("I haven't seen this"), so it is
 *     not part of Numbers at all.
 */
import type { CastEntry, NodeInfo } from "@/lib/graph/engine";
import type { TitleRow, TitleSeason } from "@/lib/titles";
import type { WatchedRating, WatchedRow, WatchedSource } from "./types";
import { isLiked, isMeh, isWatched } from "./score";

/** The slice of the industry graph Numbers needs, so tests can pass a stub. */
export interface NumbersGraph {
  idOf(imdbId: string): number | undefined;
  node(id: number): NodeInfo;
  nodeByImdbId(imdbId: string): NodeInfo | undefined;
  castOf(id: number): CastEntry[];
}

/**
 * What a person did on the titles you watched. The packed graph carries
 * character names but not IMDb's credit category, so a credit with a
 * character is an actor and everything else is `other` until TMDB's
 * `known_for_department` upgrades it (see `roleFromDepartment`, used by the
 * route once the faces come back).
 */
export type PersonRole = "actor" | "director" | "writer" | "other";

export interface NumbersTotals {
  titles: number;
  films: number;
  shows: number;
  hours: number;
  liked: number;
  meh: number;
  seen: number;
  want: number;
}

export interface NumbersPerson {
  imdbId: string;
  name: string;
  count: number;
  role: PersonRole;
}

export interface NumbersLogRow {
  imdbId: string;
  name: string;
  year: number | null;
  kind: "movie" | "series";
  /** The state: rated | want | seen | unseen. */
  state: WatchedRating;
  /** 1–10 when the row is rated, null otherwise. */
  score: number | null;
  watchedAt: string | null;
  /** When the row was last written. A `want` has no `watchedAt`; it still has this. */
  addedAt: string;
  source: WatchedSource;
  season: number | null;
  runtime: number | null;
  genres: string[];
  posterPath: string | null;
  /** The line the user typed when they logged it, word for word. */
  note: string | null;
}

export interface NumbersData {
  totals: NumbersTotals;
  /** Watched rows with no date at all, said out loud rather than guessed at. */
  undated: number;
  /** Top 12 people by credits across everything you have watched. */
  people: NumbersPerson[];
  decades: { decade: string; count: number }[];
  /** Average film runtime in minutes over what you have watched. */
  runtimeFinished: number | null;
  /** Every row, newest first. */
  log: NumbersLogRow[];
}

export interface ComputeNumbersInput {
  watched: WatchedRow[];
  titles: Map<string, TitleRow>;
  graph: NumbersGraph;
  /** Title id → the line the user typed when they logged it, if any. */
  notes?: Map<string, string>;
}

const TOP_PEOPLE = 12;

/** TMDB's `known_for_department` in the three shapes Numbers cares about. */
export function roleFromDepartment(department: string | null | undefined): PersonRole | null {
  switch ((department ?? "").toLowerCase()) {
    case "acting":
      return "actor";
    case "directing":
      return "director";
    case "writing":
      return "writer";
    default:
      return null;
  }
}

function kindOf(row: TitleRow | undefined, node: NodeInfo | undefined): "movie" | "series" {
  if (row) return row.kind;
  return node && (node.titleType === "tvSeries" || node.titleType === "tvMiniSeries") ? "series" : "movie";
}

function yearOf(row: TitleRow | undefined, node: NodeInfo | undefined): number | null {
  return row?.year ?? (node?.year ? node.year : null);
}

function genresOf(row: TitleRow | undefined, node: NodeInfo | undefined): string[] {
  if (row?.genres.length) return row.genres;
  return node?.genres ? node.genres.split(",").filter(Boolean) : [];
}

/**
 * Minutes this row is worth.
 *
 * A film is its runtime. A show is episodes × the average episode runtime,
 * where "episodes" is the counter behind "one more episode of X" when the user
 * has one, and otherwise every episode up to and including the season they
 * marked. No season pointer and no counter means no claim: zero. An unknown
 * runtime is always zero — Numbers never estimates.
 */
export function minutesOf(row: WatchedRow, title: TitleRow | undefined, kind: "movie" | "series"): number {
  const runtime = title?.runtime ?? 0;
  if (runtime <= 0) return 0;
  if (kind === "movie") return runtime;
  if (row.episodesWatched > 0) return row.episodesWatched * runtime;
  if (row.season && title?.seasons) {
    const episodes = title.seasons
      .filter((s: TitleSeason) => s.season > 0 && s.season <= row.season!)
      .reduce((n, s) => n + s.episodes, 0);
    return episodes * runtime;
  }
  return 0;
}

export function computeNumbers(input: ComputeNumbersInput): NumbersData {
  const { titles, graph } = input;
  // `unseen` is "take this off my list", not a data point.
  const rows = input.watched.filter((r) => r.rating !== "unseen");

  const totals: NumbersTotals = { titles: 0, films: 0, shows: 0, hours: 0, liked: 0, meh: 0, seen: 0, want: 0 };
  const peopleCounts = new Map<number, number>();
  const peopleActed = new Set<number>();
  const decades = new Map<string, number>();
  const log: NumbersLogRow[] = [];

  let undated = 0;
  let totalMinutes = 0;
  let runtimeSum = 0;
  let runtimeN = 0;

  for (const row of rows) {
    const title = titles.get(row.titleImdbId);
    const node = graph.nodeByImdbId(row.titleImdbId);
    const kind = kindOf(title, node);
    const year = yearOf(title, node);

    totals.titles++;
    if (kind === "series") totals.shows++;
    else totals.films++;
    if (isLiked(row)) totals.liked++;
    else if (isMeh(row)) totals.meh++;
    else if (row.rating === "seen") totals.seen++;
    else if (row.rating === "want") totals.want++;

    log.push({
      imdbId: row.titleImdbId,
      name: title?.name ?? node?.name ?? row.titleImdbId,
      year,
      kind,
      state: row.rating,
      score: row.score,
      watchedAt: row.watchedAt,
      addedAt: row.updatedAt,
      source: row.source,
      season: row.season,
      runtime: title?.runtime ?? null,
      genres: genresOf(title, node),
      posterPath: title?.posterPath ?? null,
      note: input.notes?.get(row.titleImdbId) ?? null,
    });

    // `want` is a plan and `unseen` is a no: neither is watching.
    if (!isWatched(row)) continue;

    const minutes = minutesOf(row, title, kind);
    totalMinutes += minutes;

    if (!row.watchedAt) undated++;

    if (kind === "movie" && title?.runtime) {
      runtimeSum += title.runtime;
      runtimeN++;
    }

    if (year) {
      const decade = `${Math.floor(year / 10) * 10}s`;
      decades.set(decade, (decades.get(decade) ?? 0) + 1);
    }

    const titleId = graph.idOf(row.titleImdbId);
    if (titleId === undefined) continue;
    for (const credit of graph.castOf(titleId)) {
      if (credit.node.kind !== "person") continue;
      peopleCounts.set(credit.node.id, (peopleCounts.get(credit.node.id) ?? 0) + 1);
      if (credit.character) peopleActed.add(credit.node.id);
    }
  }

  totals.hours = Math.round(totalMinutes / 60);

  const people = [...peopleCounts]
    .sort((a, b) => b[1] - a[1] || graph.node(b[0]).votes - graph.node(a[0]).votes || a[0] - b[0])
    .slice(0, TOP_PEOPLE)
    .map(([id, count]): NumbersPerson => ({
      imdbId: graph.node(id).imdbId,
      name: graph.node(id).name,
      count,
      role: peopleActed.has(id) ? "actor" : "other",
    }));

  return {
    totals,
    undated,
    people,
    decades: [...decades].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([decade, count]) => ({ decade, count })),
    runtimeFinished: runtimeN ? Math.round(runtimeSum / runtimeN) : null,
    // Newest first; a row with no date sits at the bottom, in the order the
    // store gave it (title id), so the table never reshuffles between reads.
    log: log.sort((a, b) => {
      if (a.watchedAt && b.watchedAt) return a.watchedAt < b.watchedAt ? 1 : a.watchedAt > b.watchedAt ? -1 : 0;
      if (a.watchedAt) return -1;
      if (b.watchedAt) return 1;
      return 0;
    }),
  };
}
