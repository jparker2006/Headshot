"use client";
/**
 * Imports — the three CSVs Headshot can read, in the order SPEC v4 lists them.
 * One component so You renders a single line; each importer owns its own file
 * input, its own review and its own "replaces your previous import" promise,
 * because each one replaces only its own rows.
 *
 * Chunk A's structure, not its final look: a plain sentence per importer and
 * nothing boxed, so chunk C can restyle from the winning board.
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
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="max-w-[62ch] text-[14px] text-ink-dim">
          Letterboxd: Settings → Import &amp; Export → Export your data, then drop the CSVs in. Ratings become liked or meh; the watchlist becomes want.
        </p>
        <LetterboxdImport onDone={onDone} />
      </div>

      <div className="space-y-2">
        <p className="max-w-[62ch] text-[14px] text-ink-dim">
          Netflix: Account → Profile → Viewing activity → Download all. Episodes collapse to the show, and everything comes in as seen — Netflix never
          knew whether you liked it.
        </p>
        <NetflixImport onDone={onDone} />
      </div>

      <div className="space-y-2">
        <p className="max-w-[62ch] text-[14px] text-ink-dim">
          IMDb: Your Ratings → Export. The export carries IMDb ids, so nothing is matched by name: 7 and up is liked, below that is meh.
        </p>
        <ImdbImport onDone={onDone} />
      </div>
    </div>
  );
}
