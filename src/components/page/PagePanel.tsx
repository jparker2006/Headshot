"use client";
/**
 * The title (and person) drawer, rebuilt against board C and DESIGN.md's
 * "Title drawer" section.
 *
 * It is a region, not a floating card: 420px on the right of the shell behind a
 * single `border-left`, the same `--bg` ground as the page, no radius, no
 * shadow, no blur. Full-screen sheet on a phone. Inside, the grammar is the Log
 * board's picked-title header — poster mark, name in Geist 16/600, one mono
 * facts line — then one `.btn-play` (the only accent in the view), the four
 * bucket words as the way to rate from here, the graph reason as `.t-reason`,
 * the cast as `.row`s with a 22px face marker and the role in mono, and the
 * brain page as `.t-prose`.
 *
 * Everything per-user arrives on `taste` from /api/page/[imdbId]; `taste: null`
 * means signed out, which is the only signed-out check this panel makes.
 *
 * Deviations from DESIGN.md § Title drawer, both requested in the rebuild brief:
 * the cast rows carry a 22px face marker and the role in mono (DESIGN.md says
 * "no faces"), and `later` / `seen it` sit beside Play as `.btn-quiet` in
 * addition to the four bucket words.
 */
import { useEffect, useMemo, useState } from "react";
import { Markdown } from "@/components/chat/Markdown";
import { makeIndex, type EntityIndex } from "@/components/chat/entityLinks";
import { useImages } from "@/components/chat/useImages";
import { lookupName } from "@/components/chat/lookup";
import { requireSignIn } from "@/components/auth/SignInGate";
import { factsLine } from "./facts";

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

/** The four buckets, in the log field's order. Rating is a word, never a colour. */
const BUCKETS: { bucket: "liked" | "meh" | "want" | "unseen"; label: string }[] = [
  { bucket: "liked", label: "liked" },
  { bucket: "meh", label: "meh" },
  { bucket: "want", label: "want" },
  { bucket: "unseen", label: "seen" },
];

export function PagePanel({ imdbId, onClose, onSelectNode, onAsk, onExpand }: Props) {
  const [data, setData] = useState<PageData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  /** Optimistic bucket after the user taps a word; falls back to the server's. */
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

  // Esc closes — the header states the hint in mono, so it has to be true.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const extras = data?.extras ?? null;
  const title = extras?.kind === "title" ? extras : null;
  const person = extras?.kind === "person" ? extras : null;
  const providers = title?.providers ?? null;
  const isPerson = data?.node.kind === "person";
  const signedOut = data ? data.taste === null : false;
  const onService = data?.taste?.onYourServices[0] ?? null;
  // Play is TMDB's watch-providers link (the JustWatch page), which forwards to the service.
  const playHref = providers?.link ?? null;
  const poster = title?.posterUrl ?? person?.profileUrl ?? data?.node.posterUrl;

  // The cast for a title, the credits for a person: rows, not a face wall.
  const cast = useMemo(() => (data ? data.neighbors.filter((n) => (isPerson ? n.kind === "title" : n.kind === "person")).slice(0, 14) : []), [data, isPerson]);
  const castImages = useImages(cast.map((f) => f.imdbId));
  const known = useMemo(() => new Set(data?.taste?.likedPeople ?? []), [data]);
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
  const rate = (rating: "liked" | "meh" | "want" | "unseen") => {
    if (signedOut) return requireSignIn(`/?open=${imdbId}`);
    setBucket(rating);
    const req =
      rating === "want"
        ? fetch("/api/taste/later", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ imdbId }) })
        : fetch("/api/taste/swipe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: [{ imdbId, rating }] }) });
    void req.catch(() => setBucket(data?.taste?.rating ?? null));
  };

  const facts = data
    ? factsLine({
        kind: data.node.kind,
        year: data.node.year,
        titleType: data.node.titleType,
        genres: data.node.genres,
        degree: data.node.degree,
        runtime: title?.runtime,
        seasons: title?.seasons,
        tmdbGenres: title?.genres,
        birthday: person?.birthday,
        deathday: person?.deathday,
        knownForDepartment: person?.knownForDepartment,
        onService,
      })
    : [];
  const reason = data ? reasonParts(data, nameIds) : null;
  const prose = title?.overview ?? person?.biography ?? "";

  return (
    <aside className="sheet pointer-events-auto flex h-full w-full flex-col overflow-hidden bg-bg" aria-label="Page">
      <div className="scrollbar-thin flex flex-1 flex-col gap-[30px] overflow-y-auto overflow-x-hidden pb-[18px]">
        {err && <p className="text-[13px] text-danger">{err}</p>}
        {!data && !err && <p className="t-meta">loading…</p>}
        {data && (
          <>
            {/* 1 — the picked-title header, lifted from the Log board */}
            <div className="flex flex-col gap-[18px]">
              <div className="flex items-center gap-[14px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={poster || undefined} alt="" className="poster-mark poster-mark-md shrink-0" />
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <span className="truncate text-[16px] font-semibold leading-[1.2] text-ink">{data.node.name}</span>
                  {facts.length > 0 && <span className="t-meta text-[12px] text-ink-faint">{facts.join(" · ")}</span>}
                </div>
                <button
                  onClick={onClose}
                  className="ml-auto flex h-8 shrink-0 items-center gap-2 text-ink-faint transition-colors duration-[120ms] hover:text-ink"
                  aria-label="Close"
                >
                  <span className="t-meta">esc</span>
                  <span className="text-[15px] leading-none">×</span>
                </button>
              </div>

              {/* 2 — one Play (the only accent here), then the two quiet actions.
                     Two rows rather than one wrap: at 420px a long "Play on
                     Amazon Prime Video" would leave a ragged orphan otherwise. */}
              {playHref && (
                <a href={playHref} target="_blank" rel="noreferrer" className="btn btn-play self-start">
                  {onService ? `Play on ${onService}` : "Where to watch"}
                </a>
              )}
              {!isPerson && (
                <div className="grid grid-cols-2 gap-[10px]">
                  <button type="button" onClick={() => rate("want")} className="btn btn-quiet px-0">
                    later
                  </button>
                  <button type="button" onClick={() => rate("liked")} className="btn btn-quiet px-0">
                    seen it
                  </button>
                </div>
              )}

              {/* the four bucket words: rating from the drawer uses the log
                  field's vocabulary, not a new control. */}
              {!isPerson && (
                <div className="flex flex-wrap items-center gap-[16px]">
                  {BUCKETS.map((b) => (
                    <button
                      key={b.bucket}
                      type="button"
                      onClick={() => rate(b.bucket)}
                      className={`bucket transition-colors duration-[120ms] hover:text-ink ${currentBucket === b.bucket ? "bucket-on" : ""}`}
                    >
                      {b.label}
                    </button>
                  ))}
                  {title?.trailer && (
                    <button type="button" onClick={() => setShowTrailer((v) => !v)} className="t-link ml-auto">
                      {showTrailer ? "hide trailer" : "trailer"}
                    </button>
                  )}
                </div>
              )}

              {showTrailer && title?.trailer && (
                <div className="overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
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

              {/* 3 — the graph reason: why this connects to you, one or two lines */}
              {reason && (
                <p className="t-reason">
                  {reason.map((part, i) =>
                    part.id === null ? (
                      <span key={i}>{part.text}</span>
                    ) : (
                      <button
                        key={i}
                        type="button"
                        onClick={() => (part.id ? onSelectNode(part.id) : void lookupName(part.text).then((id) => id && onSelectNode(id)))}
                        className="entity-link"
                      >
                        {part.text}
                      </button>
                    ),
                  )}
                </p>
              )}
            </div>

            {/* 4 — who is in it: rows, a 22px face marker, the role in mono */}
            {cast.length > 0 && (
              <Section title={isPerson ? "what they are in" : "who is in it"} meta={data.node.degree > cast.length ? `${data.node.degree} in all` : undefined}>
                <div className="flex flex-col">
                  {cast.map((f) => (
                    <button
                      key={f.imdbId}
                      type="button"
                      onClick={() => onSelectNode(f.imdbId)}
                      className="row text-left"
                      style={{ gridTemplateColumns: "22px minmax(0, 1fr) 88px" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={castImages[f.imdbId]?.url ?? undefined} alt="" loading="lazy" className="poster-mark" />
                      <span className={`t-row truncate ${known.has(f.imdbId) ? "text-ink" : "text-ink-dim"}`}>{f.name}</span>
                      <span className="t-meta truncate text-right">{f.character || (f.year ? String(f.year) : "")}</span>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* the TMDB blurb, quiet */}
            {prose && (
              <Section title={isPerson ? "the short version" : "what it is"}>
                {title?.tagline && <p className="t-prose mb-[6px] italic">{title.tagline}</p>}
                <p className="t-prose">{prose}</p>
              </Section>
            )}

            {/* 5 — the brain page */}
            <Section
              title="what the brain wrote"
              meta={data.page ? `after ${data.page.revisions.length} question${data.page.revisions.length === 1 ? "" : "s"}` : undefined}
            >
              {/* Markdown sets its own thread-sized type; the drawer is prose. */}
              {data.page ? (
                <div className="[&_.prose-headshot]:text-[13.5px] [&_.prose-headshot]:leading-[1.54] [&_.prose-headshot]:text-ink-dim">
                  <Markdown text={data.page.body} entities={pageEntities} onSelectNode={onSelectNode} />
                </div>
              ) : (
                <p className="t-prose">nothing written yet. ask a question that touches this and the agent starts a page.</p>
              )}
              <div className="mt-[14px] flex flex-wrap items-center gap-[16px]">
                <button onClick={() => onAsk(`Tell me about ${data.node.name} and who they're most connected to.`)} className="t-link">
                  ask about this
                </button>
                <button onClick={() => onExpand(imdbId)} className="t-link">
                  expand on the brain
                </button>
              </div>
            </Section>

            {providers && (providers.flatrate.length > 0 || providers.ads.length > 0 || providers.rent.length > 0 || providers.buy.length > 0) && (
              <Section title="where to watch" meta={title?.region?.toLowerCase()}>
                {/* service names are metadata, and the board writes metadata in mono */}
                <p className="t-meta leading-[1.7]">
                  {dedupe([...providers.flatrate, ...providers.ads, ...providers.rent, ...providers.buy])
                    .slice(0, 10)
                    .map((p) => p.name.replace(/ Amazon Channel| Apple TV Channel/, "").toLowerCase())
                    .join(" · ")}
                </p>
              </Section>
            )}

            {data.page && data.page.revisions.length > 0 && (
              <Section title="learned from">
                <div className="flex flex-col">
                  {[...data.page.revisions]
                    .reverse()
                    .slice(0, 6)
                    .map((r, i) => (
                      <div key={i} className="row" style={{ gridTemplateColumns: "72px minmax(0, 1fr)" }}>
                        <span className="t-meta">{when(r.at)}</span>
                        <span className="truncate text-[13px] text-ink-dim">{r.question}</span>
                      </div>
                    ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

/** A section: the heading, an optional mono aside, one hairline, then rows. */
function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[12px]">
      <div className="section-head">
        <h2 className="t-title">{title}</h2>
        {meta && <span className="t-meta">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

/** "3 mar" — a date short enough for a 72px mono gutter. */
function when(at: string): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" }).toLowerCase();
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
