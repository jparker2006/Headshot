import type { Brain } from "./types";

const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|terminated|Connection terminated|57P01/i;

export function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.message} ${(err as { cause?: { message?: string } }).cause?.message ?? ""}` : String(err);
  return TRANSIENT.test(msg);
}

/** Retry a call on transient connection failures with short backoff. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 150): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransient(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw last;
}

/** Wrap every async method of a brain so transient database errors are retried. */
export function resilientBrain(brain: Brain): Brain {
  const proto = Object.getPrototypeOf(brain) as Record<string, unknown>;
  const names = Object.getOwnPropertyNames(proto).filter((n) => n !== "constructor" && typeof (brain as unknown as Record<string, unknown>)[n] === "function");
  const wrapped = Object.create(proto) as Brain;
  Object.assign(wrapped, brain);
  for (const name of names) {
    const original = (brain as unknown as Record<string, (...a: unknown[]) => unknown>)[name].bind(brain);
    (wrapped as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => withRetry(() => Promise.resolve(original(...args)));
  }
  return wrapped;
}
