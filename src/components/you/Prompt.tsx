"use client";
/**
 * The composer. One line at the bottom of You and of a thread: `>` prompt,
 * what you type, `⏎` on the right (board C).
 *
 * In v4 this field did two jobs — it logged a title and it asked a question —
 * and SPEC v5 says that was the confusion at the heart of the product. Logging
 * now has its own screen with its own field (`src/components/log/LogPage.tsx`)
 * and this is the plain ask composer again: it resolves nothing, writes
 * nothing, and hands the line to the agent.
 */
import { useRef, useState } from "react";

interface Props {
  /** Put the typed line to the agent; the shell opens a thread with it. */
  onAsk: (text: string) => void;
  placeholder?: string;
}

export function Prompt({ onAsk, placeholder = "ask me anything about what you watch" }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function send() {
    const text = query.trim();
    if (!text) return;
    setQuery("");
    onAsk(text);
  }

  return (
    <div className="composer">
      <span className="tnum text-[13px] leading-none text-ink-ghost">&gt;</span>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            return setQuery("");
          }
          if (e.key === "Enter") {
            e.preventDefault();
            send();
          }
        }}
        placeholder={placeholder}
        aria-label="ask"
        className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-faint"
      />
      <span className="t-meta ml-auto shrink-0">⏎</span>
    </div>
  );
}
