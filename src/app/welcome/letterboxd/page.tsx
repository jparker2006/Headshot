"use client";
/**
 * Step two: your Letterboxd username (story 75). The crawl runs in the
 * background, so once it has started there is nothing to wait for — the step
 * says so and hands you the next one.
 */
import { useState } from "react";
import Link from "next/link";
import { LetterboxdCrawl } from "@/components/imports/LetterboxdCrawl";
import type { ImportState } from "@/components/imports/importState";
import { WelcomeStep } from "@/components/welcome/WelcomeStep";
import { nextHref } from "@/components/welcome/welcomeModel";

export default function WelcomeLetterboxd() {
  const [state, setState] = useState<ImportState>({ kind: "idle" });
  const started = state.kind === "importing" || state.kind === "done";

  return (
    <WelcomeStep step="letterboxd" title="bring your letterboxd" line="type your username and your history appears. no export, no CSV.">
      <LetterboxdCrawl onState={setState} label="Import" />
      {started && (
        <div className="flex flex-wrap items-center gap-[16px]">
          <Link href={nextHref("letterboxd")} className="btn btn-outline">
            Next
          </Link>
          <span className="t-meta">importing in the background. carry on.</span>
        </div>
      )}
    </WelcomeStep>
  );
}
