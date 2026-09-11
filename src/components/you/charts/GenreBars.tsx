"use client";
/**
 * Genres, one stacked bar each: liked in the accent, meh and seen in the
 * quieter inks. The bar is drawn in percent units and stretched to the row's
 * width, so the name on the left can stay ordinary text.
 */
import type { NumbersGenre } from "@/lib/taste/numbers";

export function GenreBars({ genres, max = 12 }: { genres: NumbersGenre[]; max?: number }) {
  const rows = genres.slice(0, max);
  if (rows.length === 0) return null;
  const peak = Math.max(...rows.map((g) => g.liked + g.meh + g.seen));
  return (
    <ul className="space-y-1.5">
      {rows.map((g) => {
        const total = g.liked + g.meh + g.seen;
        const pct = (n: number) => (n / peak) * 100;
        return (
          <li key={g.genre} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3">
            <span className="truncate text-[13.5px] text-ink">{g.genre}</span>
            <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="h-2 w-full" role="img" aria-label={`${g.genre}: ${g.liked} liked, ${g.meh} meh, ${g.seen} seen`}>
              <title>{`${g.genre}: ${g.liked} liked, ${g.meh} meh, ${g.seen} seen`}</title>
              <rect x={0} y={0} width={pct(g.liked)} height={8} className="fill-accent" />
              <rect x={pct(g.liked)} y={0} width={pct(g.meh)} height={8} className="fill-ink-dim" />
              <rect x={pct(g.liked + g.meh)} y={0} width={pct(g.seen)} height={8} className="fill-ink-faint" />
            </svg>
            <span className="text-right text-[12px] text-ink-faint">{total}</span>
          </li>
        );
      })}
    </ul>
  );
}
