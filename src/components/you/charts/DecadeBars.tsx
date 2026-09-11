"use client";
/**
 * Decades: one short bar each, biggest first. The height is fixed so the
 * labels inside the drawing stay the same size at any width.
 */
const HEIGHT = 70;
const COLUMN = 40;

export function DecadeBars({ decades }: { decades: { decade: string; count: number }[] }) {
  if (decades.length === 0) return null;
  const width = decades.length * COLUMN;
  const peak = Math.max(...decades.map((d) => d.count));
  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      preserveAspectRatio="xMinYMax meet"
      className="h-24 w-full text-ink-faint"
      role="img"
      aria-label="titles watched by decade"
    >
      {decades.map((d, i) => {
        const height = Math.max(2, (d.count / peak) * 40);
        return (
          <g key={d.decade}>
            <title>{`${d.decade}: ${d.count}`}</title>
            <rect x={i * COLUMN + 4} y={46 - height} width={COLUMN - 12} height={height} className="fill-accent" />
            <text x={i * COLUMN + 4} y={58} fontSize={9} fill="currentColor">
              {d.decade}
            </text>
            <text x={i * COLUMN + 4} y={68} fontSize={9} fill="currentColor" opacity={0.7}>
              {d.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
