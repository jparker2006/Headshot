/**
 * Permalink: a stored public answer as a shareable, indexable page. The chain
 * with faces, the narration, the follow-ups, and the ego view of the first
 * person. No composer; one button to ask your own.
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
    <main className="field min-h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[860px] px-5 py-8 md:py-12">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span className="inline-block size-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" />
            Headshot
          </Link>
          <Link href="/" className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-black">
            Ask your own
          </Link>
        </header>

        <p className="text-[13px] text-ink-dim">Someone asked</p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-ink md:text-[32px]" style={{ textWrap: "balance" }}>
          {answer.question}
        </h1>

        <section className="mt-8" aria-label="The chain">
          <div className="mb-3 flex items-baseline justify-between text-[11px] uppercase tracking-wider text-ink-dim">
            <span>
              {degrees !== null ? (
                <>
                  <span className="text-ink">{degrees}</span> {degrees === 1 ? "degree" : "degrees"} apart
                </>
              ) : (
                page.title
              )}
            </span>
            <span className="normal-case tracking-normal text-ink-faint">tap a face to explore</span>
          </div>
          <Chain chain={chain} />
        </section>

        <section className="mt-8 max-w-[62ch]">
          <Markdown text={answer.narration} />
        </section>

        {followups.length > 0 && (
          <section className="mt-8" aria-label="Keep going">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-ink-dim">Keep going</p>
            <div className="flex flex-wrap gap-2">
              {followups.map((f) => (
                <Link key={f.text} href={f.href} className="rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-[12.5px] text-ink transition hover:border-accent/70">
                  {f.text}
                </Link>
              ))}
            </div>
          </section>
        )}

        {ego && firstPerson && (
          <section className="mt-10" aria-label={`${firstPerson.name} on the brain`}>
            <p className="mb-2 text-[11px] uppercase tracking-wider text-ink-dim">
              <span className="text-ink">{firstPerson.name}</span> on the brain
            </p>
            <EgoFigure ego={ego} centerImage={firstPerson.imageUrl} />
          </section>
        )}

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-[12px] text-ink-faint">
          <span>Computed from the industry graph, narrated by the agent. Every link is a real credit.</span>
          <Link href={askHref} className="text-accent">
            Ask this again →
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Chain({ chain }: { chain: ChainNode[] }) {
  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-max items-start gap-2 pb-2">
        {chain.map((node, i) => (
          <li key={node.imdbId} className="flex items-start gap-2">
            <Link href={`/?open=${node.imdbId}`} className="group block w-[104px] md:w-[124px]" title={node.name}>
              <div
                className={`aspect-[3/4] w-full overflow-hidden rounded-xl bg-white/[0.05] ring-1 transition group-hover:ring-accent ${
                  node.kind === "person" ? "ring-accent/60" : "ring-title/60"
                }`}
              >
                {node.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={node.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[22px] font-semibold text-ink-faint">
                    {node.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? "")
                      .join("")}
                  </div>
                )}
              </div>
              <div className="mt-1.5 truncate text-[12.5px] font-semibold text-ink">{node.name}</div>
              <div className="text-[11px] text-ink-dim">{node.kind === "title" && node.year ? node.year : node.kind === "person" ? "person" : "title"}</div>
            </Link>
            {i < chain.length - 1 && <span className="pt-14 text-[20px] text-accent md:pt-16">→</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
