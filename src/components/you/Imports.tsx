"use client";
/**
 * Imports — the three CSVs Headshot can read, as three terse rows: the name,
 * one mono line saying what it costs you, and its own file control
 * (DESIGN.md → You → Services, imports, later). Each importer replaces only
 * its own rows, so each one owns its own promise.
 */
import { LetterboxdImport } from "./LetterboxdImport";
import { NetflixImport } from "./NetflixImport";
import { ImdbImport } from "./ImdbImport";

interface Props {
  /** Called after any of the three has written rows, so You can refresh. */
  onDone?: () => void;
}

export function Imports({ onDone }: Props) {
  return (
    <section className="flex flex-col gap-[12px]" aria-label="Imports">
      <div className="section-head">
        <h2 className="t-title">imports</h2>
        <span className="t-sub hidden sm:inline">re-uploading replaces that source, never piles on</span>
      </div>
      <div className="flex flex-col">
        <LetterboxdImport onDone={onDone} />
        <NetflixImport onDone={onDone} />
        <ImdbImport onDone={onDone} />
      </div>
    </section>
  );
}

