/**
 * The drawer's one mono facts line, as a pure rule so it can be tested.
 *
 * DESIGN.md § Copy: "Metadata is written the way a terminal would: `film · 157m`,
 * `show · 7 eps`, `2012 · 165m · hbo max`." Lowercase, `·` as the separator, the
 * year first because the Log board's picked-title header reads
 * `Heat  1995 · film · 170m`. Two genres at most; the service, when you pay for
 * it, closes the line.
 */

export interface FactsInput {
  kind: "person" | "title";
  year: number;
  /** The IMDb title type ("movie", "tvSeries", …) — the fallback for film vs show. */
  titleType: string;
  /** Comma-separated genres from the industry graph, used when TMDB has none. */
  genres: string;
  /** Credits for a person. */
  degree: number;
  runtime?: number;
  seasons?: number;
  /** TMDB genres, preferred over the graph's. */
  tmdbGenres?: string[];
  birthday?: string;
  deathday?: string;
  knownForDepartment?: string;
  /** The first service the user pays for that carries this title. */
  onService?: string | null;
}

export function factsLine(f: FactsInput): string[] {
  const bits: string[] = [];
  if (f.kind === "person") {
    if (f.birthday) bits.push(`born ${f.birthday.slice(0, 4)}`);
    if (f.deathday) bits.push(`died ${f.deathday.slice(0, 4)}`);
    if (f.knownForDepartment) bits.push(f.knownForDepartment.toLowerCase());
    if (f.degree) bits.push(`${f.degree} credits`);
    return bits;
  }
  if (f.year) bits.push(String(f.year));
  bits.push(f.seasons || /series/i.test(f.titleType) ? "show" : "film");
  if (f.seasons) bits.push(`${f.seasons} season${f.seasons === 1 ? "" : "s"}`);
  else if (f.runtime) bits.push(`${f.runtime}m`);
  const genres = f.tmdbGenres?.length ? f.tmdbGenres : f.genres.split(",").filter(Boolean);
  if (genres.length) bits.push(genres.slice(0, 2).join(", ").toLowerCase());
  if (f.onService) bits.push(f.onService.toLowerCase());
  return bits;
}
