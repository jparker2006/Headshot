"use client";
/**
 * What the swipe session changed about you (SPEC v4 → Swipe as lore: "a diff
 * view (added / removed lines) shown before returning to You").
 *
 * Board C grammar and nothing else: a `.section-head` with a mono count, then
 * the moved lines as rows — a mono `+` at `--ink` for what the rewrite added,
 * a mono `−` at `--ink-faint` with the text struck through for what it
 * dropped. No cards, no colour on the signs: the only colour on a board C
 * screen is a poster, and there are none here.
 *
 * Under it the whole profile as it stands now, through the same `MemoryProse`
 * the You page uses, so the diff is read in context rather than in isolation.
 */
import { lookupName } from "@/components/chat/lookup";
import { MemoryProse } from "./MemoryProse";
import { diffCount, diffLines, type MemoryDiffLines } from "./swipeRules";

interface Props {
  diff: MemoryDiffLines;
  /** The memory as it now reads, markdown. */
  after: string;
  /** False when the rewrite decided the session said nothing new. */
  rewritten: boolean;
  /** Leave catch-up: back to the log. */
  onExit: () => void;
  /** The exit link's words. */
  exitLabel?: string;
  /** Deal another ten. */
  onAgain: () => void;
  onSelectNode?: (imdbId: string) => void;
}

export function MemoryDiff({ diff, after, rewritten, onExit, exitLabel = "back to the log", onAgain, onSelectNode }: Props) {
  const added = diffLines(diff.added);
  const removed = diffLines(diff.removed);
  const moved = added.length + removed.length > 0;

  const lookup = (name: string) => {
    if (!onSelectNode) return;
    void lookupName(name).then((id) => id && onSelectNode(id));
  };

  return (
    <div className="flex flex-col gap-[28px] sm:gap-[38px]" aria-label="What changed">
      <section className="flex flex-col gap-[12px]">
        <div className="section-head">
          <h2 className="t-title">what changed</h2>
          <span className="t-meta tnum">{diffCount({ added, removed })}</span>
        </div>

        {!rewritten && <p className="t-prose max-w-[880px]">nothing new to say yet — a few more and it will.</p>}
        {rewritten && !moved && <p className="t-prose max-w-[880px]">it read the same thing back. the log grew all the same.</p>}

        {/* Two lists, not one column of nineteen rows: 18px of air between
            them so `+13 −6` can be read off the page. The lines are prose, so
            they take prose's 880px measure and, unlike a `.row`, they do not
            light up under the cursor — nothing here is clickable. */}
        <div className="flex max-w-[880px] flex-col gap-[18px]">
          {added.length > 0 && (
            <div className="flex flex-col">
              {added.map((line, i) => (
                <div key={`+${i}`} className="grid min-h-[38px] grid-cols-[14px_minmax(0,1fr)] items-baseline gap-[14px] py-[9px]">
                  <span className="t-meta text-ink">+</span>
                  <span className="t-prose text-ink">{line}</span>
                </div>
              ))}
            </div>
          )}
          {removed.length > 0 && (
            <div className="flex flex-col">
              {removed.map((line, i) => (
                <div key={`-${i}`} className="grid min-h-[38px] grid-cols-[14px_minmax(0,1fr)] items-baseline gap-[14px] py-[9px]">
                  <span className="t-meta text-ink-faint">−</span>
                  <span className="t-prose text-ink-faint line-through">{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-[16px]">
        <div className="section-head">
          <h2 className="t-title">your profile now</h2>
        </div>
        {after.trim() ? (
          <MemoryProse markdown={after} onLookup={lookup} />
        ) : (
          <p className="t-prose">nothing written yet. keep going and it will have something to say.</p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-[18px]">
        {/* another ten is the invitation, so it takes the button; leaving is
            the quiet one. Same two slots as before, the labels swapped. */}
        <button type="button" onClick={onAgain} className="btn btn-outline">
          ten more
        </button>
        <button type="button" onClick={onExit} className="t-link">
          {exitLabel}
        </button>
      </div>
    </div>
  );
}
