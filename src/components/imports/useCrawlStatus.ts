"use client";
/**
 * `GET /api/taste/import/letterboxd`, read once and then every three seconds
 * for as long as the crawl says `running` — and not once after it stops (SPEC
 * v5 → Letterboxd crawl). The Log page uses it for its one
 * `importing from Letterboxd…` line; Settings and `/welcome` restart it after
 * they kick a crawl off.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { POLL_MS, type CrawlStatusBody } from "./importState";

async function read(): Promise<CrawlStatusBody | null> {
  try {
    const res = await fetch("/api/taste/import/letterboxd", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as CrawlStatusBody;
  } catch {
    return null;
  }
}

export interface CrawlWatch {
  /** The last status the route reported, or null before the first answer. */
  body: CrawlStatusBody | null;
  /** Start watching again — after a POST that started a crawl. */
  restart: () => void;
}

/**
 * `onFinished` fires once per run, when a crawl this hook was watching stops.
 * The Log page bumps `logBus` there so the table picks up what just landed.
 */
export function useCrawlStatus(enabled: boolean, onFinished?: () => void): CrawlWatch {
  const [body, setBody] = useState<CrawlStatusBody | null>(null);
  const [nonce, setNonce] = useState(0);
  const wasRunning = useRef(false);
  // Held in a ref so a caller's inline callback does not restart the poll.
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loop = async () => {
      const next = await read();
      if (!alive || !next) return;
      setBody(next);
      if (wasRunning.current && next.status !== "running") finished.current?.();
      wasRunning.current = next.status === "running";
      if (next.status === "running") timer = setTimeout(() => void loop(), POLL_MS);
    };
    void loop();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, nonce]);

  const restart = useCallback(() => {
    wasRunning.current = true;
    setNonce((n) => n + 1);
  }, []);

  return { body, restart };
}
