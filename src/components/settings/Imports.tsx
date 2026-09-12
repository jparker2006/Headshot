"use client";
/**
 * Imports (SPEC v5 → Settings page). The first way in is a username, not a
 * file: type it and the crawl reads the public Letterboxd pages in the
 * background. The CSV path is still here, but it is the fallback it should
 * always have been — offered on its own when you ask for it, and offered
 * automatically when the crawl says the profile is private.
 *
 * Then the two exports that have no public pages to read: Netflix and IMDb.
 * Each importer replaces only its own rows, so each one owns its own promise.
 */
import { useState } from "react";
import { LetterboxdCrawl } from "@/components/imports/LetterboxdCrawl";
import { showCsvFallback, type ImportState } from "@/components/imports/importState";
import { LetterboxdImport } from "./LetterboxdImport";
import { NetflixImport } from "./NetflixImport";
import { ImdbImport } from "./ImdbImport";

interface Props {
  /** Called after any of them has written rows, so the page can refresh. */
  onDone?: () => void;
}

export function Imports({ onDone }: Props) {
  const [crawl, setCrawl] = useState<ImportState>({ kind: "idle" });
  const [csvAsked, setCsvAsked] = useState(false);
  const csv = csvAsked || showCsvFallback(crawl);

  return (
    <section className="flex flex-col gap-[16px]" aria-label="Imports">
      <div className="section-head">
        <h2 className="t-title">imports</h2>
        <span className="t-sub hidden sm:inline">re-importing replaces that source, never piles on</span>
      </div>

      <div className="flex flex-col gap-[12px]">
        <span className="t-strong">letterboxd</span>
        <LetterboxdCrawl onState={setCrawl} onDone={onDone} />
        {!csv && (
          <button type="button" onClick={() => setCsvAsked(true)} className="t-link self-start">
            use the CSV export instead
          </button>
        )}
      </div>

      <div className="flex flex-col">
        {csv && <LetterboxdImport onDone={onDone} />}
        <NetflixImport onDone={onDone} />
        <ImdbImport onDone={onDone} />
      </div>
    </section>
  );
}
