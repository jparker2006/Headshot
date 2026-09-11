import { getBrain } from "@/lib/brain";
import { getIndustryGraph } from "@/lib/graph";
import { tmdbFromEnv } from "@/lib/tmdb/client";
import { loadAnswerPage } from "@/lib/answers/permalink";
import { OG_SIZE, ogImageFor } from "@/lib/answers/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "The chain of credits behind this answer";

/** Open Graph image for a stored answer: posters and arrows on the dark ground. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [brain, graph] = await Promise.all([getBrain(), getIndustryGraph()]);
  const page = await loadAnswerPage({ brain, graph, tmdb: tmdbFromEnv() }, slug);
  if (!page) return new Response("Not found", { status: 404 });
  return ogImageFor(page);
}
