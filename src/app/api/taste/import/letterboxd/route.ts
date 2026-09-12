import { tasteHandlers } from "@/lib/taste/deps";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { username, force? } starts the crawl; GET reports how the last one went. */
export const POST = tasteHandlers.startLetterboxdCrawl;
export const GET = tasteHandlers.letterboxdCrawlStatus;
