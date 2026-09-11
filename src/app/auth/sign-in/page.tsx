"use client";

/**
 * Sign in, board C (DESIGN.md → Sign-in): one centred column at 560px on the
 * ground, the wordmark top-left and nothing else in the chrome. The email
 * field is drawn like the log field — 46px, one `--line-input` underline, a
 * mono `>` prompt, a block caret — and the button is the outlined one.
 *
 * Magic link only: no passwords are offered here and none are accepted as a
 * fallback (SPEC v3). Reached from `requireSignIn(next)`; `?next=` becomes the
 * link's callback URL, and a link that has already been spent (mail clients
 * prefetch them) lands back here as `?error=` with the state that explains it.
 */
import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { isSpentLink } from "@/components/auth/linkError";

/** Seconds before "Send it again" becomes available. */
const RESEND_AFTER = 30;

/** The plugin is toggled in the Neon console; until then the endpoint 404s. */
const PLUGIN_OFF =
  "magic link sign-in is not switched on for this project yet. enable the Magic Link plugin in the Neon console (Auth → Plugins) and add this domain under trusted domains.";

const noop = () => () => {};

/** `?next=` and `?error=`, read after hydration so the server HTML stays stable. */
function useParam(name: string, fallback = ""): string {
  return useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).get(name) || fallback,
    () => fallback,
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
  const next = useParam("next", "/");
  const linkError = useParam("error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [dismissedLinkError, setDismissedLinkError] = useState(false);
  const elapsed = useSecondsSince(sentAt);
  const canResend = sentAt !== null && elapsed >= RESEND_AFTER;
  const spent = !dismissedLinkError && status === "idle" && linkError !== "" && isSpentLink(linkError);

  const send = useCallback(
    async (address: string) => {
      setStatus("sending");
      setError(null);
      setDismissedLinkError(true);
      try {
        const result = (await authClient.signIn.magicLink({
          email: address,
          callbackURL: next,
          // A spent or expired link comes back here, not to a bare error page.
          errorCallbackURL: `/auth/sign-in?error=invalid_link&next=${encodeURIComponent(next)}`,
        } as Parameters<typeof authClient.signIn.magicLink>[0])) as { error?: unknown } | undefined;
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
    <main className="field flex h-full w-full flex-col overflow-y-auto">
      <div className="px-4 pt-[22px] md:px-[34px]">
        <Link href="/" className="text-[14px] font-bold leading-none tracking-[-0.02em] text-ink">
          headshot
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-[56px] md:px-[34px]">
        <div className="w-full max-w-[560px]">
          {status === "sent" ? (
            <>
              <h1 className="t-title">check your email</h1>
              <p className="t-prose pt-[14px]">
                sent. a link is on its way to <span className="text-ink">{email.trim()}</span>. open it on this device and you are in.
              </p>
              <div className="flex items-center gap-[14px] pt-[22px]">
                <button onClick={() => void send(email.trim())} disabled={!canResend} className="t-link disabled:cursor-default disabled:opacity-60">
                  {canResend ? "send it again" : `send it again in ${RESEND_AFTER - elapsed}s`}
                </button>
                <button
                  onClick={() => {
                    setStatus("idle");
                    setSentAt(null);
                  }}
                  className="t-link"
                >
                  use another address
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="t-title">{spent ? "that link is already spent" : "an account holds your taste. headshot itself works without one."}</h1>
              <p className="t-prose pt-[14px]">
                {spent
                  ? "mail clients open links before you do, which uses them up. type your address and we will send a fresh one."
                  : "what you have seen, what you pay for, what I remember about you. the chat and the shared brain stay open signed out."}
              </p>

              <form onSubmit={onSubmit} className="pt-[26px]">
                <label htmlFor="email" className="sr-only">
                  email
                </label>
                <div className="flex h-[46px] max-w-[420px] items-center gap-[14px] border-b" style={{ borderColor: "var(--line-input)" }}>
                  <span className="font-mono text-[15px] leading-none text-ink-ghost" aria-hidden>
                    &gt;
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="t-input min-w-0 flex-1 border-0 bg-transparent p-0 outline-none placeholder:text-ink-faint"
                  />
                  {email === "" && <span className="caret shrink-0" aria-hidden />}
                </div>

                <div className="flex items-center gap-[14px] pt-[22px]">
                  <button type="submit" disabled={status === "sending" || email.trim() === ""} className="btn btn-outline disabled:opacity-40">
                    {status === "sending" ? "Sending…" : spent ? "Send it again" : "Send the link"}
                  </button>
                  <span className="t-meta">we&apos;ll email you a link. no password, ever.</span>
                </div>
              </form>

              {error && <p className="max-w-[62ch] pt-[18px] text-[13.5px] leading-[1.54] text-ink">{error}</p>}
            </>
          )}

          <Link href="/" className="t-link mt-[40px] inline-block">
            back to headshot
          </Link>
        </div>
      </div>
    </main>
  );
}

function messageOf(err: unknown): string {
  const m = (err as { message?: string } | null)?.message;
  return m && m.length > 0 ? `${m} try again.` : "that did not send. try again.";
}
