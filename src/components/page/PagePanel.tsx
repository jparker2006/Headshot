"use client";
/**
 * The title (and person) drawer, built against design/boards/Title.dc.html and
 * DESIGN.md's "Title" layout: poster and headline, one mono facts line, the
 * reason set large with names as links, the actions row (Play, later, seen it,
 * trailer), the cast as a face row with the people you already like ringed in
 * accent, then the brain page. No cards; sections separate by space and one
 * hairline.
 *
 * Everything per-user arrives on `taste` from /api/page/[imdbId]; `taste: null`
 * means signed out, which is the only signed-out check this panel makes.
 */
import { useEffect, useMemo, useState } from "react";
import { Markdown } from "@/components/chat/Markdown";
import { makeIndex, type EntityIndex } from "@/components/chat/entityLinks";
import { useImages } from "@/components/chat/useImages";
import { lookupName } from "@/components/chat/lookup";
import { requireSignIn } from "@/components/auth/SignInGate";

interface Neighbor {
  imdbId: string;
  name: string;
  kind: string;
  titleType: string;
  year: number;
  tier: number;
  character?: string | null;
}

interface PageTaste {
  reason: { text: string; viaImdbIds: string[]; viaNames: string[] } | null;
  likedPeople: string[];
  rating: "liked" | "meh" | "unseen" | "want" | null;
  onYourServices: string[];
}

interface PageData {
  node: {
    imdbId: string;
    name: string;
    kind: "person" | "title";
    titleType: string;
    year: number;
    votes: number;
    genres: string;
    inIndustryGraph: boolean;
    inBrain: boolean;
    posterUrl?: string;
    knownAs?: string;
    degree: number;
  };
  page: { body: string; updatedAt: string; revisions: { at: string; question: string }[] } | null;
  neighbors: Neighbor[];
  taste: PageTaste | null;
  extras:
    | null
    | {
        kind: "title";
        rating: number;
        voteCount: number;
        runtime?: number;
        seasons?: number;
        tagline?: string;
        overview: string;
        posterUrl?: string;
        backdropUrl?: string;
        genres: string[];
        trailer: { youtubeKey: string; name: string } | null;
        providers: { link?: string; flatrate: Provider[]; rent: Provider[]; buy: Provider[]; ads: Provider[] } | null;
        region: string;
      }
    | {
        kind: "person";
        biography: string;
        birthday?: string;
        deathday?: string;
        placeOfBirth?: string;
        knownForDepartment?: string;
        profileUrl?: string;
      };
}
interface Provider {
  id?: number;
  name: string;
  logoUrl?: string;
}

interface Props {
  imdbId: string;
  onClose: () => void;
  onSelectNode: (imdbId: string) => void;
  onAsk: (text: string) => void;
  onExpand: (imdbId: string) => void;
}

const BUCKET_LABEL: Record<string, string> = { liked: "you liked this", meh: "you called it meh", unseen: "marked unseen", want: "in later" };

export function PagePanel({ imdbId, onClose, onSelectNode, onAsk, onExpand }: Props) {
  const [data, setData] = useState<PageData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  /** Optimistic bucket after the user taps a chip; falls back to the server's. */
  const [bucket, setBucket] = useState<PageTaste["rating"] | undefined>(undefined);

  // Names on the page that link: the subject and its neighbors.
  const pageEntities = useMemo<EntityIndex>(
    () =>
      makeIndex(
        data
          ? [
              { imdbId: data.node.imdbId, name: data.node.name, kind: data.node.kind },
              ...data.neighbors.map((n) => ({ imdbId: n.imdbId, name: n.name, kind: n.kind === "person" ? ("person" as const) : ("title" as const) })),
            ]
          : [],
      ),
    [data],
  );

  // The parent keys this panel by imdbId, so state resets on every new node.
  useEffect(() => {
    let alive = true;
    fetch(`/api/page/${imdbId}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error ?? r.statusText))))
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [imdbId]);

  const extras = data?.extras ?? null;
  const title = extras?.kind === "title" ? extras : null;
  const person = extras?.kind === "person" ? extras : null;
  const providers = title?.providers ?? null;
  const isPerson = data?.node.kind === "person";
  const signedOut = data ? data.taste === null : false;
  const onService = data?.taste?.onYourServices[0] ?? null;
  const poster = title?.posterUrl ?? person?.profileUrl ?? data?.node.posterUrl;

  // The face row: the cast for a title, the credits for a person.
  const faces = useMemo(() => (data ? data.neighbors.filter((n) => (isPerson ? n.kind === "title" : n.kind === "person")).slice(0, 16) : []), [data, isPerson]);
  const faceImages = useImages(faces.map((f) => f.imdbId));
  const ringed = useMemo(() => new Set(data?.taste?.likedPeople ?? []), [data]);
  // Ids the reason can cite, so its names become links without a lookup round-trip.
  const nameIds = useMemo(() => {
    const m = new Map<string, string>();
    if (data) {
      m.set(data.node.name.toLowerCase(), data.node.imdbId);
      for (const n of data.neighbors) m.set(n.name.toLowerCase(), n.imdbId);
    }
    return m;
  }, [data]);

  const currentBucket = bucket !== undefined ? bucket : (data?.taste?.rating ?? null);
  const rate = (rating: "liked" | "want") => {
    if (signedOut) return requireSignIn(`/?open=${imdbId}`);
    setBucket(rating);
    const req =
      rating === "want"
        ? fetch("/api/taste/later", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ imdbId }) })
        : fetch("/api/taste/swipe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: [{ imdbId, rating: "liked" }] }) });
    void req.catch(() => setBucket(data?.taste?.rating ?? null));
  };

  const facts = data ? factsLine(data, title, person, onService, providers) : [];
  const reason = data ? reasonParts(data, nameIds) : null;

  return (
    <aside className="panel pointer-events-auto flex h-full w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden" aria-label="Page">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
          {data ? (isPerson ? "person" : data.node.titleType || "title") : "loading"}
        </span>
        <button onClick={onClose} className="rounded-full px-2 py-1 font-mono text-[10.5px] text-ink-dim transition-colors duration-[120ms] hover:text-ink" aria-label="Close">
          close
        </button>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-5">
        {err && <p className="text-[13px] text-danger">{err}</p>}
        {data && (
          <>
            {/* 1 — poster, name, the one mono facts line */}
            <div className="flex gap-4">
              <div className="aspect-[3/4] w-[104px] shrink-0 overflow-hidden rounded-[14px] bg-white/[0.04] ring-1 ring-line">
                {poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <h2 className="text-[22px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink text-balance">
                  {data.node.name}
                  {!isPerson && data.node.year ? <span className="ml-1.5 font-normal text-ink-faint tabular-nums">{data.node.year}</span> : null}
                </h2>
                {facts.length > 0 && (
                  <p className="font-mono text-[11px] leading-[1.5] text-ink-dim">
                    {facts.map((f, i) => (
                      <span key={i} className={f.strong ? "text-ink" : undefined}>
                        {i > 0 ? " · " : ""}
                        {f.text}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </div>

            {/* 2 — the reason, set large */}
            {reason && (
              <p className="mt-5 text-[18px] leading-[1.3] tracking-[-0.01em] text-ink-dim">
                {reason.map((part, i) =>
                  part.id === null ? (
                    <span key={i}>{part.text}</span>
                  ) : (
                    <button
                      key={i}
                      type="button"
                      onClick={() => (part.id ? onSelectNode(part.id) : void lookupName(part.text).then((id) => id && onSelectNode(id)))}
                      className="font-medium text-ink underline-offset-4 decoration-accent/50 transition-colors duration-[120ms] hover:underline"
                    >
                      {part.text}
                    </button>
                  ),
                )}
              </p>
            )}

            {/* 3 — actions */}
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3">
              {providers?.link && (
                <a
                  href={providers.link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-black transition-[filter] duration-[120ms] hover:brightness-110"
                >
                  {onService ? `Play on ${onService}` : "Where to watch"}
                </a>
              )}
              {!isPerson && (
                <>
                  <button
                    type="button"
                    onClick={() => rate("want")}
                    className="rounded-full border border-line px-3 py-1.5 font-mono text-[11px] text-ink-dim transition-colors duration-[120ms] hover:border-accent/40 hover:text-ink"
                  >
                    later
                  </button>
                  <button
                    type="button"
                    onClick={() => rate("liked")}
                    className="rounded-full border border-line px-3 py-1.5 font-mono text-[11px] text-ink-dim transition-colors duration-[120ms] hover:border-accent/40 hover:text-ink"
                  >
                    seen it
                  </button>
                </>
              )}
              {title?.trailer && (
                <button type="button" onClick={() => setShowTrailer((v) => !v)} className="font-mono text-[11px] text-ink-faint transition-colors duration-[120ms] hover:text-ink">
                  {showTrailer ? "hide trailer" : "trailer"}
                </button>
              )}
              {currentBucket && <span className="font-mono text-[11px] text-ink-faint">{BUCKET_LABEL[currentBucket]}</span>}
            </div>

            {showTrailer && title?.trailer && (
              <div className="mt-3 overflow-hidden rounded-[14px] ring-1 ring-line" style={{ aspectRatio: "16 / 9" }}>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${title.trailer.youtubeKey}`}
                  title={title.trailer.name}
                  loading="lazy"
                  allow="accelerometer; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            )}

            {/* 4 — the face row */}
            {faces.length > 0 && (
              <section className="mt-6 border-t border-line pt-5">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
                  {isPerson ? "credits" : "cast"}
                  {ringed.size > 0 ? " · the ones you know are lit" : ""}
                </p>
                <div className="scrollbar-thin -mx-4 mt-2.5 flex gap-3 overflow-x-auto px-4 pb-2">
                  {faces.map((f) => (
                    <button key={f.imdbId} type="button" onClick={() => onSelectNode(f.imdbId)} className="w-[84px] shrink-0 text-left">
                      <div
                        className={`h-[112px] w-[84px] overflow-hidden rounded-[10px] bg-white/[0.05] ${ringed.has(f.imdbId) ? "ring-1 ring-accent" : "ring-1 ring-line"}`}
                      >
                        {faceImages[f.imdbId]?.url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={faceImages[f.imdbId]!.url!} alt="" className="h-full w-full object-cover" loading="lazy" />
                        )}
                      </div>
                      <p className="mt-1.5 text-[12px] font-semibold leading-[1.2] text-ink">{f.name}</p>
                      <p className="font-mono text-[10.5px] leading-[1.3] text-ink-faint">{f.character ?? (f.year ? String(f.year) : "")}</p>
                    </button>
                  ))}
                  {data.node.degree > faces.length && (
                    <span className="flex h-[112px] w-[84px] shrink-0 items-center justify-center font-mono text-[11px] text-ink-faint">+ {data.node.degree - faces.length}</span>
                  )}
                </div>
              </section>
            )}

            {/* the TMDB blurb, quiet beneath the reason */}
            {(title?.overview || person?.biography) && (
              <section className="mt-6 border-t border-line pt-5">
                {title?.tagline && <p className="mb-1 text-[13px] italic text-ink-dim">{title.tagline}</p>}
                <p className="max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-dim">{title?.overview ?? person?.biography}</p>
              </section>
            )}

            {/* 5 — the brain page, then the page's own actions */}
            <section className="mt-6 border-t border-line pt-5">
              <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
                brain page{data.page ? ` · written after ${data.page.revisions.length} question${data.page.revisions.length === 1 ? "" : "s"}` : ""}
              </p>
              {data.page ? (
                <div className="max-w-[62ch] text-[14.5px] leading-[1.55]">
                  <Markdown text={data.page.body} entities={pageEntities} onSelectNode={onSelectNode} />
                </div>
              ) : (
                <p className="text-[13px] text-ink-faint">Nothing written yet. Ask a question that touches this and the agent will start a page.</p>
              )}
            </section>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onAsk(`Tell me about ${data.node.name} and who they're most connected to.`)}
                className="font-mono text-[11px] text-accent transition-colors duration-[120ms] hover:brightness-110"
              >
                ask about this
              </button>
              <button onClick={() => onExpand(imdbId)} className="font-mono text-[11px] text-ink-faint transition-colors duration-[120ms] hover:text-ink">
                expand on the brain
              </button>
            </div>

            {providers && (providers.flatrate.length > 0 || providers.ads.length > 0 || providers.rent.length > 0 || providers.buy.length > 0) && (
              <section className="mt-6 border-t border-line pt-5">
                <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">where to watch · {title?.region}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {dedupe([...providers.flatrate, ...providers.ads, ...providers.rent, ...providers.buy])
                    .slice(0, 10)
                    .map((p) => (
                      <span key={p.name} title={p.name} className="flex items-center gap-1.5 font-mono text-[10.5px] text-ink-dim">
                        {p.logoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.logoUrl} alt="" className="size-4 rounded-[4px]" />
                        )}
                        {p.name.replace(/ Amazon Channel| Apple TV Channel/, "")}
                      </span>
                    ))}
                </div>
              </section>
            )}

            {data.page && data.page.revisions.length > 0 && (
              <section className="mt-6 border-t border-line pt-5">
                <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">learned from</p>
                <ul className="space-y-1">
                  {[...data.page.revisions]
                    .reverse()
                    .slice(0, 6)
                    .map((r, i) => (
                      <li key={i} className="text-[12.5px] text-ink-dim">
                        <span className="font-mono text-[11px] text-ink-faint tabular-nums">{new Date(r.at).toLocaleDateString()}</span> · “{r.question}”
                      </li>
                    ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

interface Fact {
  text: string;
  /** The one thing on the line that is in ink rather than ink-dim: "on max". */
  strong: boolean;
}

/** "2h 50 · 8.3 · crime, drama · on max" — one line, mono, the service in ink. */
function factsLine(
  data: PageData,
  title: Extract<PageData["extras"], { kind: "title" }> | null,
  person: Extract<PageData["extras"], { kind: "person" }> | null,
  onService: string | null,
  providers: { rent: Provider[]; buy: Provider[] } | null,
): Fact[] {
  const bits: Fact[] = [];
  const plain = (text: string) => bits.push({ text, strong: false });
  if (data.node.kind === "person") {
    if (person?.birthday) plain(`born ${person.birthday.slice(0, 4)}${person.placeOfBirth ? ` · ${person.placeOfBirth}` : ""}`);
    if (person?.deathday) plain(`died ${person.deathday.slice(0, 4)}`);
    if (data.node.degree) plain(`${data.node.degree} credits`);
    return bits;
  }
  if (title?.seasons) plain(`${title.seasons} season${title.seasons === 1 ? "" : "s"}`);
  else if (title?.runtime) plain(title.runtime >= 60 ? `${Math.floor(title.runtime / 60)}h ${title.runtime % 60}` : `${title.runtime}m`);
  if (title && title.rating > 0) plain(title.rating.toFixed(1));
  const genres = title?.genres?.length ? title.genres : data.node.genres.split(",").filter(Boolean);
  if (genres.length) plain(genres.slice(0, 2).join(", ").toLowerCase());
  if (onService) bits.push({ text: `on ${onService.toLowerCase()}`, strong: true });
  else if (providers?.rent.length) plain("rent");
  else if (providers?.buy.length) plain("buy");
  return bits;
}

interface ReasonPart {
  text: string;
  /** An id to open, "" to resolve the name lazily, null for plain prose. */
  id: string | null;
}

/**
 * The reason line, split into prose and linkable names. The signed-in line is
 * the taste reason; signed out it falls back to the neighborhood ("known for").
 */
function reasonParts(data: PageData, nameIds: Map<string, string>): ReasonPart[] | null {
  const taste = data.taste?.reason;
  if (taste) {
    // The cited names come back with the reason, and their ids alongside, so
    // every name in the line links even when it is not on this page.
    const ids = new Map(nameIds);
    taste.viaNames.forEach((name, i) => {
      const id = taste.viaImdbIds[i];
      if (name && id) ids.set(name.toLowerCase(), id);
    });
    const cited = taste.viaNames.filter(Boolean);
    return split(taste.text, cited.length ? cited : [...ids.keys()], ids);
  }
  const isPerson = data.node.kind === "person";
  const top = data.neighbors.filter((n) => (isPerson ? n.kind === "title" : n.kind === "person")).slice(0, 3);
  if (top.length === 0) return null;
  const parts: ReasonPart[] = [{ text: isPerson ? "known for " : "with ", id: null }];
  top.forEach((n, i) => {
    if (i > 0) parts.push({ text: i === top.length - 1 ? " and " : ", ", id: null });
    parts.push({ text: n.name, id: n.imdbId });
  });
  parts.push({ text: ".", id: null });
  return parts;
}

/** Split a sentence around the names it cites, longest first so "Tom Hanks" wins over "Tom". */
function split(text: string, names: string[], nameIds: Map<string, string>): ReasonPart[] {
  const wanted = [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (wanted.length === 0) return [{ text, id: null }];
  const re = new RegExp(`(${wanted.map(escapeRe).join("|")})`, "gi");
  return text
    .split(re)
    .filter(Boolean)
    .map((chunk) => {
      const id = nameIds.get(chunk.toLowerCase());
      return id ? { text: chunk, id } : wanted.some((w) => w.toLowerCase() === chunk.toLowerCase()) ? { text: chunk, id: "" } : { text: chunk, id: null };
    });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dedupe(items: Provider[]): Provider[] {
  const seen = new Set<string>();
  return items.filter((p) => (seen.has(p.name) ? false : (seen.add(p.name), true)));
}
