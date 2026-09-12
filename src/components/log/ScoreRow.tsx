"use client";
/**
 * The row of ten (SPEC v5, "Ratings"): one tap, 1–10, the way IMDb does it.
 * Replaces the four bucket words everywhere a rating is given — the Log page,
 * the drawer, the catch-up deck — so all three read identically.
 *
 * Pure: it holds no state, fetches nothing, and knows nothing about what the
 * score is for. The keyboard map and the words live in `scoreRules.ts`.
 *
 * Sizes: `md` is the board's 44px cell (design/boards-v5/Log.dc.html, and the
 * same on the phone board, where the ten wrap five-and-five); `sm` is a 28px
 * cell for a tight column. **Deviation** from the brief's "md: 36px": the
 * approved boards draw 44 at both widths and DESIGN.md → Rhythm puts every
 * button at 44–46, so the board wins.
 */
import { useEffect } from "react";
import { SCORES, keyForScore, scoreFromKey } from "./scoreRules";

interface Props {
  /** The chosen score, or null when nothing is picked yet. */
  value: number | null;
  onChange: (score: number) => void;
  size?: "sm" | "md";
  /** Listen for 1–9 and 0 on the document (ignored while typing in a field). */
  keyboard?: boolean;
  /** An optional quiet line above the row. */
  label?: string;
}

/** True when the keystroke belongs to whatever the user is typing into. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

export function ScoreRow({ value, onChange, size = "md", keyboard = false, label }: Props) {
  useEffect(() => {
    if (!keyboard) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const score = scoreFromKey(e.key);
      if (score == null) return;
      e.preventDefault();
      onChange(score);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [keyboard, onChange]);

  const cell = size === "md" ? "h-11 w-11 text-[13.5px]" : "h-7 w-7 text-[12px]";

  return (
    <div className="flex flex-col gap-[10px]">
      {label && <span className="t-sub">{label}</span>}
      <div
        className={`grid w-fit grid-cols-5 gap-[6px] sm:flex sm:flex-wrap sm:items-center`}
        role="group"
        aria-label="score out of ten"
      >
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
            aria-pressed={value === score}
            aria-label={`${score} out of 10`}
            onClick={() => onChange(score)}
            className={`tnum inline-flex items-center justify-center rounded-[6px] ${cell} ${
              value === score ? "btn-solid font-bold" : "btn-fill"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
      {size === "md" && (
        <span className="t-meta">
          keys {keyForScore(1)}…{keyForScore(10)} · {keyForScore(10)} is ten
        </span>
      )}
    </div>
  );
}
