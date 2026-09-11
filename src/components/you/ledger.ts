/**
 * The two rules every ledger row obeys, kept pure so `tests/client/ledger.test.ts`
 * can hold them to account without a renderer.
 *
 * Board C draws a figure as `label | figure | bar`: the bar's width is the
 * datum as a share of its block's biggest value, and its alpha — never a hue —
 * ranks it inside the block (DESIGN.md → Numbers ledger).
 */

/** Width of a bar as a CSS percentage. A non-zero datum never draws as nothing. */
export function barWidth(value: number, max: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0 || value <= 0) return "0%";
  return `${Math.min(100, Math.max(2, Math.round((value / max) * 100)))}%`;
}

export type BarRank = "strong" | "base" | "weak";

/**
 * Where a row sits in its block: the top one or two rows are `strong`, the
 * last row of a block of three or more is the `weak` tail, everything between
 * is the base alpha. A two-row block is simply strong then weak.
 */
export function barRank(index: number, total: number): BarRank {
  if (total <= 1) return "strong";
  if (total === 2) return index === 0 ? "strong" : "weak";
  if (index <= 1) return "strong";
  if (index >= total - 1) return "weak";
  return "base";
}

/** The class for a rank; `.ledger-bar` alone is the base alpha. */
export function barClass(rank: BarRank): string {
  return rank === "base" ? "ledger-bar" : `ledger-bar ledger-bar-${rank}`;
}

/** A block's ink level: the rows that carry the block sit at `--ink`, the tail at `--ink-dim`. */
export function rowInk(index: number, total: number): string {
  return barRank(index, total) === "strong" ? "text-ink" : "text-ink-dim";
}
