/**
 * Permalink: a stored public answer as a shareable, indexable page.
 *
 * Board C, Thread grammar, minus the bubbles — this is a document someone
 * landed on, not a conversation they are in (DESIGN.md § Sign-in and landing:
 * "/a/… answer pages keep working signed out and use the Thread grammar
 * unchanged"). So: the question as `.t-title` over one hairline, the chain as a
 * thin row of poster marks with mono captions, the narration as `.t-say`
 * paragraphs at the 880px column cap, the follow-ups as `.chip`s, the ego
 * figure unboxed. No accent anywhere: nothing on this page is Play.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrain } from "@/lib/brain";
import { getIndustryGraph } from "@/lib/graph";
import { tmdbFromEnv } from "@/lib/tmdb/client";
import { loadAnswerPage, type AnswerPage, type ChainNode } from "@/lib/answers/permalink";
import { Markdown } from "@/components/chat/Markdown";
import { EgoFigure } from "./EgoFigure";

export const dynamic = "force-dynamic";

async function load(slug: string): Promise<AnswerPage | null> {
  const [brain, graph] = await Promise.all([getBrain(), getIndustryGraph()]);
  const origin = process.env.HEADSHOT_ORIGIN ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return loadAnswerPage({ brain, graph, tmdb: tmdbFromEnv(), origin }, slug);
}

export async function generateMetadata({ params }: PageProps<"/a/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) return { title: "Not found · Headshot", robots: { index: false } };
  const description = page.answer.narration.replace(/\*+/g, "").slice(0, 200);
  return {
    title: `${page.title} · Headshot`,
    description,
    robots: { index: true, follow: true },
    alternates: page.url ? { canonical: page.url } : undefined,
    openGraph: { title: page.title, description, type: "article", url: page.url || undefined },
    twitter: { card: "summary_large_image", title: page.title, description },
  };
}

export default async function AnswerPermalink({ params }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) notFound();
  const { answer, chain, degrees, followups, ego, firstPerson } = page;
  const askHref = `/?q=${encodeURIComponent(answer.question)}`;

  return (
    <main className="field scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[1000px] flex-col gap-[30px] px-[16px] pb-[32px] pt-[22px] md:px-[34px]">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-[14px] font-bold tracking-[-0.02em] text-ink">
            headshot
          </Link>
          <Link href="/" className="btn btn-quiet">
            Ask your own
          </Link>
        </header>

        <div className="section-head">
          <h1 className="t-title">{answer.question}</h1>
          <span className="t-meta">
            {degrees !== null ? `${degrees} ${degrees === 1 ? "degree" : "degrees"} apart` : page.title.toLowerCase()}
            {" · "}
            {chain.length} in the chain
          </span>
        </div>

        <section className="flex flex-col gap-[12px]" aria-label="The chain">
          <Chain chain={chain} />
          <span className="t-meta">tap a poster to open it</span>
        </section>

        <section className="max-w-[880px]" aria-label="The answer">
          {/* Markdown carries the thread's own size; this is the same 14/1.52 say. */}
          <div className="[&_.prose-headshot]:text-[14px] [&_.prose-headshot]:leading-[1.52] [&_.prose-headshot]:text-ink-dim [&_.prose-headshot_p+p]:mt-[11px]">
            <Markdown text={answer.narration} />
          </div>
        </section>

        {followups.length > 0 && (
          <section className="flex flex-col gap-[10px]" aria-label="Keep going">
            <span className="t-sub">keep going</span>
            <div className="flex flex-wrap gap-[9px]">
              {followups.map((f) => (
                <Link key={f.text} href={f.href} className="chip">
                  {f.text}
                </Link>
              ))}
            </div>
          </section>
        )}

        {ego && firstPerson && (
          <section className="flex flex-col gap-[12px]" aria-label={`${firstPerson.name} on the brain`}>
            <div className="section-head">
              <h2 className="t-title">{firstPerson.name.toLowerCase()} on the brain</h2>
              <span className="t-meta">{ego.nodes.filter((n) => n.ring === 1).length} closest</span>
            </div>
            <EgoFigure ego={ego} centerImage={firstPerson.imageUrl} />
          </section>
        )}

        <footer className="mt-auto flex flex-wrap items-center gap-x-[14px] gap-y-[8px] border-t border-line pt-[16px]">
          <span className="t-meta">computed from the industry graph, narrated by the agent. every link is a real credit.</span>
          <Link href={askHref} className="t-link ml-auto">
            ask this again
          </Link>
        </footer>
      </div>
    </main>
  );
}

/** The chain: thin poster marks, mono captions, a mono arrow between. */
function Chain({ chain }: { chain: ChainNode[] }) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <ol className="flex min-w-max items-start gap-[14px] pb-[4px]">
        {chain.map((node, i) => (
          <li key={node.imdbId} className="flex items-start gap-[14px]">
            <Link href={`/?open=${node.imdbId}`} className="flex w-[104px] flex-col gap-[6px]" title={node.name}>
              {node.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={node.imageUrl} alt="" className="poster-mark poster-mark-lg" />
              ) : (
                <span className="poster-mark poster-mark-lg" />
              )}
              <span className="text-[13px] font-medium leading-[1.25] text-ink">{node.name}</span>
              <span className="t-meta">{node.kind === "title" ? (node.year ? String(node.year) : "") : ""}</span>
            </Link>
            {i < chain.length - 1 && <span className="t-meta pt-[18px] text-[13px]">→</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
