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
 * same on the phone board, where the ten wrap five-and-five across the column);
 * `sm` is a 28px cell for a tight column — but only from the `sm` breakpoint
 * up: on a phone both sizes stay at 44px, which is the touch minimum.
 * **Deviation** from the brief's "md: 36px": the approved boards draw 44 at
 * both widths and DESIGN.md → Rhythm puts every button at 44–46, so the board
 * wins.
 */
import { useEffect, useState } from "react";
import { SCORES, formatScore, hasDecimal, keyForScore, nearestCell, parseScore, scoreFromKey } from "./scoreRules";

interface Props {
  /** The chosen score, or null when nothing is picked yet. */
  value: number | null;
  onChange: (score: number) => void;
  size?: "sm" | "md";
  /** Listen for 1–9 and 0 on the document (ignored while typing in a field). */
  keyboard?: boolean;
  /** An optional quiet line above the row. */
  label?: string;
  /**
   * Offer the tenths field beside the row (SPEC v5.1). The ten cells stay whole
   * numbers — a tap is a tap — and someone who means 9.7 types it here.
   */
  decimal?: boolean;
}

/** True when the keystroke belongs to whatever the user is typing into. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

export function ScoreRow({ value, onChange, size = "md", keyboard = false, label, decimal = false }: Props) {
  const [typed, setTyped] = useState("");
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

  // A phone has no cursor and no keyboard: the cells stay at the board's 44px
  // and fill their five columns, at both sizes. `sm` shrinks to 28px only from
  // the `sm` breakpoint up, where there is a mouse to hit it with.
  const cell = size === "md" ? "h-11 w-full text-[13.5px] sm:w-11" : "h-11 w-full text-[13.5px] sm:h-7 sm:w-7 sm:text-[12px]";
  // A decimal lights the cell it is nearest to; the exact figure is printed
  // beside the row, since the ten cells cannot say 9.7 themselves.
  const lit = nearestCell(value);

  return (
    <div className="flex w-full flex-col gap-[10px] sm:w-auto">
      {label && <span className="t-sub">{label}</span>}
      {/* the board draws the cells and the key hint on one line, and lets them
          break where the column is too narrow for both */}
      <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[10px]">
        <div
          className={`grid w-full shrink-0 grid-cols-5 gap-[6px] sm:flex sm:w-auto sm:shrink sm:flex-wrap sm:items-center`}
          role="group"
          aria-label="score out of ten"
        >
          {SCORES.map((score) => (
            <button
              key={score}
              type="button"
              aria-pressed={lit === score}
              aria-label={`${score} out of 10`}
              onClick={() => {
                setTyped("");
                onChange(score);
              }}
              className={`tnum inline-flex shrink-0 items-center justify-center rounded-[6px] ${cell} ${
                lit === score ? "btn-solid font-bold" : "btn-fill"
              }`}
            >
              {score}
            </button>
          ))}
        </div>
        {/* the exact figure, whenever it is finer than the cell that is lit */}
        {hasDecimal(value) && value != null && <span className="tnum text-[13.5px] leading-none text-ink">{formatScore(value)}</span>}
        {decimal && (
          <input
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              const parsed = parseScore(e.target.value);
              if (parsed != null) onChange(parsed);
            }}
            inputMode="decimal"
            aria-label="or type a score, e.g. 9.7"
            placeholder="9.7"
            className="tnum h-[28px] w-[46px] shrink-0 border-b border-[color:var(--line-note)] bg-transparent text-center text-[13px] text-ink outline-none placeholder:text-ink-ghost focus:border-[color:var(--line-strong)]"
          />
        )}
        {/* the keys, hidden where there is no keyboard to press them */}
        {size === "md" && (
          <span className="t-meta hidden sm:inline">
            keys {keyForScore(1)}…{keyForScore(10)} · {keyForScore(10)} is ten
          </span>
        )}
      </div>
    </div>
  );
}
