"use client";
/**
 * The last 24 months: films and shows stacked, hours as a thin line on its own
 * axis. Hand-drawn SVG, no library.
 *
 * The bars carry no text — the month labels live in HTML underneath, so they
 * are the same size whether the chart is 390px or 760px wide and the drawing
 * itself can stretch (`preserveAspectRatio="none"`) to fill whatever it gets.
 */
import { useState } from "react";
import type { NumbersMonth } from "@/lib/taste/numbers";

const COLUMN = 10;
const BAR = 7;
const HEIGHT = 100;

/** "2026-03" → "Mar", and a January says the year instead. */
function label(month: string): string {
  const [year, m] = month.split("-");
  if (m === "01") return `’${year.slice(2)}`;
  return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m)] ?? "";
}

export function MonthsChart({ months }: { months: NumbersMonth[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = months.length * COLUMN;
  const peak = Math.max(1, ...months.map((m) => m.films + m.shows));
  const peakHours = Math.max(1, ...months.map((m) => m.hours));
  const y = (n: number) => HEIGHT - (n / peak) * (HEIGHT - 12);
  const hoursY = (n: number) => HEIGHT - (n / peakHours) * (HEIGHT - 12);
  const shown = hover === null ? null : months[hover];

  return (
    <div className="space-y-1">
      <p className="text-[13px] text-ink-dim" aria-live="polite">
        {shown
          ? `${shown.month}: ${shown.films} film${shown.films === 1 ? "" : "s"}, ${shown.shows} show${shown.shows === 1 ? "" : "s"}, ${shown.hours} hours`
          : `busiest month: ${peak} title${peak === 1 ? "" : "s"}`}
      </p>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-40 w-full text-ink-faint"
        role="img"
        aria-label="titles watched per month over the last two years"
      >
        <line x1={0} y1={HEIGHT} x2={width} y2={HEIGHT} stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {months.map((m, i) => {
          const x = i * COLUMN + (COLUMN - BAR) / 2;
          const films = HEIGHT - y(m.films);
          const shows = HEIGHT - y(m.films + m.shows) - films;
          return (
            <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <title>{`${m.month}: ${m.films} films, ${m.shows} shows, ${m.hours} hours`}</title>
              {/* An invisible full-height target, so the thin months are hoverable too. */}
              <rect x={i * COLUMN} y={0} width={COLUMN} height={HEIGHT} fill="transparent" />
              <rect x={x} y={HEIGHT - films} width={BAR} height={films} className="fill-accent" opacity={hover === null || hover === i ? 1 : 0.5} />
              <rect x={x} y={HEIGHT - films - shows} width={BAR} height={shows} className="fill-ink-dim" opacity={hover === null || hover === i ? 1 : 0.5} />
            </g>
          );
        })}
        <polyline
          points={months.map((m, i) => `${i * COLUMN + COLUMN / 2},${hoursY(m.hours)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex text-[10px] text-ink-faint">
        {months.map((m, i) => (
          <span key={m.month} className="flex-1 text-center">
            {i % 3 === 0 ? label(m.month) : ""}
          </span>
        ))}
      </div>
      <p className="text-[12px] text-ink-faint">
        <span className="text-accent">films</span> · <span className="text-ink-dim">shows</span> · the line is hours (peak {peakHours})
      </p>
    </div>
  );
}
