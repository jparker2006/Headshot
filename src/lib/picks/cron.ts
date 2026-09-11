/**
 * The overnight run (v3): for every user active in the last 30 days, refresh
 * availability, rescore, and store tonight's picks and deck so opening the
 * app is instant. One cheap model call per user for the reason lines.
 */
import type { TonightDeps } from "./service";
import { computeTonight } from "./service";

export interface CronResult {
  users: number;
  computed: number;
  skipped: number;
  failed: { userId: string; error: string }[];
  ms: number;
}

export async function runNightly(deps: TonightDeps, opts: { activeDays?: number; now?: () => Date; concurrency?: number } = {}): Promise<CronResult> {
  const started = Date.now();
  const now = opts.now?.() ?? new Date();
  const since = new Date(now.getTime() - (opts.activeDays ?? 30) * 24 * 60 * 60 * 1000);
  const users = await deps.store.activeUsers(since);
  const result: CronResult = { users: users.length, computed: 0, skipped: 0, failed: [], ms: 0 };
  let i = 0;
  const worker = async () => {
    while (i < users.length) {
      const userId = users[i++];
      try {
        const data = await computeTonight(deps, userId);
        if (data) result.computed++;
        else result.skipped++;
      } catch (err) {
        result.failed.push({ userId, error: err instanceof Error ? err.message : String(err) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 3, Math.max(users.length, 1)) }, worker));
  result.ms = Date.now() - started;
  deps.log?.(`[cron] tonight: ${result.computed} computed, ${result.skipped} skipped, ${result.failed.length} failed in ${result.ms}ms`);
  return result;
}

/** Vercel Cron calls with `Authorization: Bearer $CRON_SECRET`; anything else is refused. */
export function cronAuthorized(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
