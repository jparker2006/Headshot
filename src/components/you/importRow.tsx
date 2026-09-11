"use client";
/**
 * The two pieces every importer draws with: a terse 38px row, and a file
 * picker that looks like a `.t-link` rather than a browser button. Their own
 * file so `Imports` can compose the three importers without a cycle.
 */
import type { ReactNode } from "react";

/**
 * One importer's line. `note` is the mono aside; `controls` is whatever the
 * importer needs on the right — a file picker, an Import link, a count.
 */
export function ImportRow({ name, note, controls }: { name: string; note: string; controls: ReactNode }) {
  return (
    <div className="row h-auto grid-cols-[minmax(0,1fr)] gap-y-[6px] py-[8px] sm:h-[38px] sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:py-0">
      <span className="text-[14px] font-medium text-ink">{name}</span>
      <span className="t-meta sm:truncate">{note}</span>
      <span className="flex flex-wrap items-center gap-[14px] sm:justify-self-end">{controls}</span>
    </div>
  );
}

/**
 * A file picker that looks like the rest of the page: a `.t-link` word that
 * becomes the file's name once one is chosen. The input itself is the control
 * for accessibility; it is only visually hidden.
 */
export function FilePick({ name, label, chosen, onPick }: { name: string; label: string; chosen: string | null; onPick: (file: File | null) => void }) {
  return (
    <label className="cursor-pointer">
      <span className={`t-link ${chosen ? "text-ink" : ""}`}>{chosen ?? label}</span>
      <input
        type="file"
        name={name}
        accept=".csv,text/csv"
        aria-label={label}
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
