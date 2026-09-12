"use client";
/**
 * "type your Letterboxd username and your history appears" (SPEC v5, story
 * 75). One field drawn like every other field here — 46px, a mono `>`, one
 * `--line-input` hairline — then `Import`, then one line saying where it got
 * to. The crawl runs in the background, so that line is the whole progress
 * report; a private profile turns it into the CSV instruction and the caller
 * reveals its CSV control.
 *
 * Every decision it makes is in `importState.ts`; this only draws. The state
 * the page shows is the reducer's, moved on by the poll rather than by a
 * second write: `importing` plus the latest status is `done`, so nothing has
 * to be dispatched out of an effect.
 */
import { useCallback, useEffect, useReducer, useState } from "react";
import {
  eventFromPost,
  importLine,
  importReducer,
  initialImport,
  shouldPoll,
  showCsvFallback,
  validUsername,
  type ImportState,
} from "./importState";
import { useCrawlStatus } from "./useCrawlStatus";

interface Props {
  /** Told whenever the state moves, so the page can reveal the CSV path. */
  onState?: (state: ImportState) => void;
  /** Called once a crawl has finished and there are rows to read. */
  onDone?: () => void;
  /** `Import` on Settings; onboarding says what it is really doing. */
  label?: string;
}

export function LetterboxdCrawl({ onState, onDone, label = "Import" }: Props) {
  const [username, setUsername] = useState("");
  const [state, dispatch] = useReducer(importReducer, initialImport);
  const [busy, setBusy] = useState(false);

  const watch = useCrawlStatus(shouldPoll(state), onDone);
  const shown = watch.body && shouldPoll(state) ? importReducer(state, { type: "status", body: watch.body }) : state;

  useEffect(() => {
    onState?.(shown);
    // Only the shape matters to the caller; a changing callback must not refire it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.kind]);

  const submit = useCallback(async () => {
    const name = username.trim();
    if (!validUsername(name)) return dispatch({ type: "invalid" });
    dispatch({ type: "submit", username: name });
    setBusy(true);
    try {
      const res = await fetch("/api/taste/import/letterboxd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
      const body: unknown = await res.json().catch(() => ({}));
      const event = eventFromPost(res.status, body);
      dispatch(event);
      if (event.type === "started") watch.restart();
      if (event.type === "cached") onDone?.();
    } catch {
      dispatch({ type: "failed" });
    } finally {
      setBusy(false);
    }
  }, [username, watch, onDone]);

  return (
    <div className="flex max-w-[560px] flex-col gap-[14px]">
      <div className="flex h-[46px] items-center gap-[12px] border-b border-[color:var(--line-input)]">
        <span className="tnum text-[15px] leading-none text-ink-ghost">&gt;</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          aria-label="letterboxd username"
          placeholder="letterboxd username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[15px] leading-none text-ink outline-none placeholder:text-ink-faint"
        />
      </div>

      <div className="flex flex-wrap items-center gap-[16px]">
        <button type="button" onClick={() => void submit()} disabled={busy || username.trim() === ""} className="btn btn-outline disabled:opacity-40">
          {label}
        </button>
        <span className={`t-meta ${showCsvFallback(shown) ? "text-ink-dim" : ""}`}>{importLine(shown)}</span>
      </div>
    </div>
  );
}
