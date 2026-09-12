"use client";
/**
 * Settings (SPEC v5 → Settings page, story 79): everything that is plumbing
 * rather than taste, in one place, so You can be about you. Four sections in
 * the page's own rhythm — a `.section-head` with one hairline under it, then
 * rows — and no new grammar anywhere.
 *
 *   account      the email, Sign out, and the one irreversible thing here
 *   services     what you pay for, so tonight only picks what you can open
 *   imports      letterboxd by username (crawl), then the CSVs
 *   in your words the pinned notes, the same PUT as You's `edit`
 *
 * Signed out there is nothing to set, so it sends you to sign in and back.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInHref, signOut, useSessionUser } from "@/components/auth/SignInGate";
import { bumpLog } from "@/components/you/logBus";
import { ServicesChecklist } from "./ServicesChecklist";
import { Imports } from "./Imports";

export function SettingsPage() {
  const { user, loading } = useSessionUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace(signInHref("/settings"));
  }, [loading, user, router]);

  if (loading) return <p className="t-meta">…</p>;
  if (!user) return <p className="t-meta">sending you to sign in…</p>;

  return (
    <div className="flex max-w-[880px] flex-col gap-[28px] sm:gap-[38px]" aria-label="Settings">
      <h1 className="t-title">settings</h1>
      <Account email={user.email} />
      <ServicesChecklist />
      <Imports onDone={bumpLog} />
      <PinnedNotes />
    </div>
  );
}

// ---- account ---------------------------------------------------------------

/**
 * Deleting an account takes the log, the memory and the chats with it and
 * there is no undo, so it asks once: the link becomes `delete everything?` at
 * `--danger` and only the second click commits — the same two-step the rail
 * uses on a chat, which is the only other irreversible control in the product.
 */
function Account({ email }: { email: string | null }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me", { method: "DELETE" });
      if (!res.ok) {
        setError("that did not go through. try again.");
        setConfirm(false);
        return;
      }
      await signOut();
    } catch {
      setError("that did not go through. try again.");
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <section className="flex flex-col gap-[12px]" aria-label="Account">
      <div className="section-head">
        <h2 className="t-title">account</h2>
        <span className="t-sub hidden sm:inline">magic link only. there is no password to lose</span>
      </div>

      <div className="row grid-cols-[minmax(0,1fr)]">
        <span className="truncate text-[14px] text-ink">{email ?? "signed in"}</span>
      </div>

      <div className="flex flex-wrap items-center gap-[22px] pt-[6px]">
        <button type="button" onClick={() => void signOut()} className="btn btn-outline">
          Sign out
        </button>
        <button
          type="button"
          onClick={() => (confirm ? void remove() : setConfirm(true))}
          onBlur={() => setConfirm(false)}
          disabled={busy}
          className={`t-link ${confirm ? "text-danger" : ""}`}
        >
          {busy ? "deleting…" : confirm ? "delete everything?" : "delete account"}
        </button>
        {confirm && !busy && <span className="t-meta">the log, the memory and the chats. no undo.</span>}
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}
    </section>
  );
}

// ---- in your words ---------------------------------------------------------

/**
 * The pinned block: lines the rewrite copies through verbatim, so they are the
 * one part of the memory the machine is not allowed to reword. Same PUT as
 * You's `edit`, given room here because this is where you would come to write
 * a paragraph rather than a line.
 */
function PinnedNotes() {
  const [pinned, setPinned] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/taste/memory", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { pinned: string }) : null))
      .then((m) => alive && setPinned(m?.pinned ?? ""))
      .catch(() => alive && setPinned(""));
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const r = await fetch("/api/taste/memory", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pinned: pinned ?? "" }),
      });
      if (r.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }, [pinned]);

  return (
    <section className="flex flex-col gap-[12px]" aria-label="In your words">
      <div className="section-head">
        <h2 className="t-title">in your words</h2>
        <span className="t-sub hidden sm:inline">kept exactly as you write them, never reworded</span>
      </div>

      {pinned === null ? (
        <p className="t-meta">reading…</p>
      ) : (
        <>
          <textarea
            value={pinned}
            onChange={(e) => {
              setPinned(e.target.value);
              setSaved(false);
            }}
            rows={6}
            aria-label="in your words"
            className="t-note w-full resize-y border-b border-[color:var(--line-note)] bg-transparent pb-[8px] outline-none placeholder:text-ink-ghost"
            placeholder="I will watch anything shot on film."
          />
          <div className="flex items-center gap-[16px]">
            <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-outline disabled:opacity-40">
              {saving ? "saving…" : "Save"}
            </button>
            {saved && <span className="t-meta">saved</span>}
          </div>
        </>
      )}
    </section>
  );
}
