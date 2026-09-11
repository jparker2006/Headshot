"use client";
/**
 * The memory, drawn the way board C draws it: three equal columns of short
 * `.t-prose` lines at a 6px rhythm, `.t-strong` headings, and the `Notes`
 * section quoted back at `.t-note`. Every **name** is bold-500 and a link —
 * the cursor-for-movies rule, which holds here as much as in a bubble.
 *
 * CSS columns rather than a grid on purpose: the board's first column runs on
 * into the second mid-section, which is what a column flow does for free.
 */
import type { ReactNode } from "react";

interface Props {
  markdown: string;
  /** Resolve a bold name to an id and open it. */
  onLookup: (name: string) => void;
}

type Block =
  | { kind: "heading"; text: string; first: boolean }
  | { kind: "line"; text: string; note: boolean };

/** The rewrite job writes `## What you love`; the board says `what you love`. */
function headingText(raw: string): string {
  const text = raw.replace(/^#+\s*/, "").trim();
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Markdown → the flat list of blocks the column flow renders. */
export function memoryBlocks(markdown: string): Block[] {
  const out: Block[] = [];
  let notes = false;
  let seenHeading = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const text = headingText(line);
      notes = text.startsWith("note");
      out.push({ kind: "heading", text, first: !seenHeading });
      seenHeading = true;
      continue;
    }
    out.push({ kind: "line", text: line.replace(/^[-*]\s+/, ""), note: notes });
  }
  return out;
}

/** `**Heat**` → a link; everything else stays text. */
function inline(text: string, onLookup: (name: string) => void): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, i) =>
      part.startsWith("**") ? (
        <button key={i} type="button" className="entity-link" onClick={() => onLookup(part.slice(2, -2))}>
          {part.slice(2, -2)}
        </button>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
}

export function MemoryProse({ markdown, onLookup }: Props) {
  const blocks = memoryBlocks(markdown);
  if (blocks.length === 0) return null;
  return (
    <div className="[column-gap:34px] sm:[columns:2] lg:[columns:3]">
      {blocks.map((b, i) =>
        b.kind === "heading" ? (
          <h3
            key={i}
            className={`t-strong break-inside-avoid [break-after:avoid] ${b.first ? "" : "mt-[14px]"} mb-[4px]`}
          >
            {b.text}
          </h3>
        ) : (
          <p key={i} className={`${b.note ? "t-note" : "t-prose"} mb-[6px] break-inside-avoid`}>
            {inline(b.text, onLookup)}
          </p>
        ),
      )}
    </div>
  );
}
