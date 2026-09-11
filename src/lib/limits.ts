/**
 * Cost controls. Per-IP rate limit (in-process token bucket; Vercel Firewall
 * is the production edge layer) and a global daily question cap backed by the
 * brain so it holds across instances. When the cap trips, the brain stays
 * browsable and the chat rests until tomorrow.
 */
import type { Brain } from "@/lib/brain/types";

export const SESSION_COOKIE = "headshot_session";

export function newSessionId(): string {
  return crypto.randomUUID();
}

export interface LimitOptions {
  brain: Brain;
  ip: string;
  /** Questions per IP per window. */
  perIp?: number;
  windowMs?: number;
  dailyCap?: number;
  now?: () => number;
}

export type LimitResult = { ok: true } | { ok: false; reason: "rate_limited" | "daily_cap" };

const buckets = new Map<string, number[]>();

export async function checkLimits(opts: LimitOptions): Promise<LimitResult> {
  const now = opts.now?.() ?? Date.now();
  const perIp = opts.perIp ?? Number(process.env.HEADSHOT_PER_IP_PER_MINUTE ?? 10);
  const windowMs = opts.windowMs ?? 60_000;
  const dailyCap = opts.dailyCap ?? Number(process.env.HEADSHOT_DAILY_QUESTION_CAP ?? 500);

  const hits = (buckets.get(opts.ip) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= perIp) {
    buckets.set(opts.ip, hits);
    return { ok: false, reason: "rate_limited" };
  }
  hits.push(now);
  buckets.set(opts.ip, hits);

  if ((await opts.brain.countQuestionsToday()) >= dailyCap) return { ok: false, reason: "daily_cap" };
  return { ok: true };
}

/** Test hook. */
export function resetLimits(): void {
  buckets.clear();
}
