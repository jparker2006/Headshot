"use client";

/**
 * Sign in. Magic link only — no passwords are offered here and none are
 * accepted as a fallback (SPEC v3). Reached from `requireSignIn(next)`; the
 * `?next=` parameter becomes the magic link's callback URL.
 */
import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

/** Seconds before "Send it again" becomes available. */
const RESEND_AFTER = 30;

/** The plugin is toggled in the Neon console; until then the endpoint 404s. */
const PLUGIN_OFF =
  "Magic link sign-in isn't switched on for this project yet. Enable the Magic Link plugin in the Neon console (Auth → Plugins) and add this domain under trusted domains.";

const noop = () => () => {};

/** `?next=`, read after hydration so the server HTML stays stable. */
function useNextParam(): string {
  return useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).get("next") || "/",
    () => "/",
  );
}

/**
 * A once-per-second clock as an external store, so the countdown never reads
 * the wall clock during render and never sets state from an effect. The store
 * caches the timestamp; render only reads the cached number.
 */
let nowMs = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function subscribeTick(fn: () => void): () => void {
  listeners.add(fn);
  nowMs = Date.now();
  timer ??= setInterval(() => {
    nowMs = Date.now();
    for (const l of listeners) l();
  }, 1000);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
function useSecondsSince(startedAt: number | null): number {
  const now = useSyncExternalStore(
    subscribeTick,
    () => nowMs,
    () => 0,
  );
  return startedAt === null ? 0 : Math.max(0, Math.min(RESEND_AFTER, Math.floor((now - startedAt) / 1000)));
}

type Status = "idle" | "sending" | "sent";

/** True when the failure is "the Magic Link plugin is not enabled". */
function isPluginOff(err: unknown): boolean {
  const e = err as { status?: number | string; statusCode?: number; message?: string; code?: string } | null;
  if (!e) return false;
  if (e.status === 404 || e.statusCode === 404 || e.status === "NOT_FOUND") return true;
  return /not found|404|magic.?link|plugin|unknown path/i.test(`${e.code ?? ""} ${e.message ?? ""}`);
}

export default function SignInPage() {
  const next = useNextParam();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const elapsed = useSecondsSince(sentAt);
  const canResend = sentAt !== null && elapsed >= RESEND_AFTER;

  const send = useCallback(
    async (address: string) => {
      setStatus("sending");
      setError(null);
      try {
        const result = (await authClient.signIn.magicLink({
          email: address,
          callbackURL: next,
        })) as { error?: unknown } | undefined;
        if (result?.error) {
          setError(isPluginOff(result.error) ? PLUGIN_OFF : messageOf(result.error));
          setStatus("idle");
          return;
        }
        setSentAt(Date.now());
        setStatus("sent");
      } catch (err) {
        setError(isPluginOff(err) ? PLUGIN_OFF : messageOf(err));
        setStatus("idle");
      }
    },
    [next],
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const address = email.trim();
      if (!address) return;
      void send(address);
    },
    [email, send],
  );

  return (
    <main className="field flex h-full w-full items-center justify-center overflow-y-auto px-5 py-12">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" />
          <span className="text-[15px] font-semibold tracking-tight text-ink">Headshot</span>
        </div>

        {status === "sent" ? (
          <>
            <h1 className="mt-8 text-[26px] font-semibold leading-8 tracking-tight text-balance text-ink">Check your email</h1>
            <p className="mt-3 text-[14.5px] leading-[1.55] text-ink-dim">
              A link is on its way to <span className="text-ink">{email.trim()}</span>. Open it on this device and you are in.
            </p>
            <div className="my-7 h-px bg-line" />
            <button
              onClick={() => void send(email.trim())}
              disabled={!canResend}
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint transition-colors duration-[120ms] enabled:hover:text-ink disabled:cursor-default"
            >
              {canResend ? "Send it again" : `Send it again in ${RESEND_AFTER - elapsed}s`}
            </button>
            <button
              onClick={() => {
                setStatus("idle");
                setSentAt(null);
              }}
              className="mt-3 block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint transition-colors duration-[120ms] hover:text-ink"
            >
              Use another address
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-8 text-[26px] font-semibold leading-8 tracking-tight text-balance text-ink">Sign in</h1>
            <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-dim">
              An account holds your taste — what you have seen, what you pay for. Headshot itself works without one.
            </p>
            <form onSubmit={onSubmit} className="mt-7">
              <label htmlFor="email" className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-2 block h-11 w-full rounded-full border border-line bg-transparent px-4 text-[14.5px] text-ink outline-none transition-colors duration-[120ms] placeholder:text-ink-faint focus:border-accent"
              />
              <button
                type="submit"
                disabled={status === "sending" || email.trim() === ""}
                className="mt-4 h-11 w-full rounded-full bg-accent text-[13.5px] font-semibold text-bg transition-[filter] duration-[120ms] enabled:hover:brightness-110 disabled:opacity-40"
              >
                {status === "sending" ? "Sending…" : "Send me a link"}
              </button>
            </form>
            {error && <p className="mt-4 max-w-[62ch] text-[13px] leading-[1.55] text-ink-dim">{error}</p>}
          </>
        )}

        <Link
          href="/"
          className="mt-10 block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint transition-colors duration-[120ms] hover:text-ink"
        >
          ← Back to Headshot
        </Link>
      </div>
    </main>
  );
}

function messageOf(err: unknown): string {
  const m = (err as { message?: string } | null)?.message;
  return m && m.length > 0 ? `${m} Try again.` : "That didn't send. Try again.";
}
