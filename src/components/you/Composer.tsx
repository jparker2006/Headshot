"use client";
/**
 * The composer at the bottom of You. Typing here opens a thread and sends the
 * question, so there is one way in rather than a "New chat" button beside a
 * home screen. The thread surface keeps its own composer (ChatPanel's).
 */
import { useState } from "react";

export function Composer({ onSubmit, placeholder = "ask about anything you've watched…" }: { onSubmit: (text: string) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const send = () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    onSubmit(t);
  };
  return (
    <div className="bg-gradient-to-t from-bg via-bg to-transparent">
      <form
        className="mx-auto flex w-full max-w-[760px] items-end gap-2 px-6 pb-5 pt-3 md:px-8"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === "Return") && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          aria-label="ask"
          placeholder={placeholder}
          className="max-h-40 min-h-[46px] flex-1 resize-none rounded-xl bg-raised px-4 py-3 text-[14.5px] text-ink outline-none ring-1 ring-line shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-shadow duration-[120ms] placeholder:text-ink-faint focus:ring-line-strong"
        />
        <button type="submit" disabled={!input.trim()} className="h-[46px] rounded-xl bg-accent px-4 text-[13px] font-semibold text-black transition-[filter] duration-[120ms] hover:brightness-110 disabled:opacity-40">
          Ask
        </button>
      </form>
    </div>
  );
}
