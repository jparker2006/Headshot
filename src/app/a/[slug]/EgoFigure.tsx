/**
 * Static ego view for permalinks: the center with its first ring on a circle,
 * server-rendered SVG so the page needs no canvas or JavaScript to show it.
 */
import type { EgoNetwork } from "@/lib/graph/ego";

export function EgoFigure({ ego, centerImage }: { ego: EgoNetwork; centerImage: string | null }) {
  const center = ego.nodes.find((n) => n.ring === 0);
  const ring = ego.nodes.filter((n) => n.ring === 1).slice(0, 16);
  if (!center) return null;
  const W = 760;
  const H = 420;
  const cx = W / 2;
  const cy = H / 2;
  const R = 160;
  const pts = ring.map((n, i) => {
    const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
    return { n, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  });
  return (
    <figure className="overflow-x-auto rounded-2xl border border-line bg-white/[0.02]">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${center.name} and ${ring.length} closest collaborators`} className="h-auto w-full min-w-[520px]">
        <defs>
          <clipPath id="ego-center">
            <circle cx={cx} cy={cy} r={34} />
          </clipPath>
        </defs>
        {pts.map((p) => (
          <line key={`l-${p.n.imdbId}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={p.n.kind === "title" ? "#7d8cc4" : "#f4b63f"} strokeOpacity={0.35} strokeWidth={1.2} />
        ))}
        {pts.map((p) => (
          <g key={p.n.imdbId}>
            <circle cx={p.x} cy={p.y} r={p.n.kind === "title" ? 7 : 6} fill={p.n.kind === "title" ? "#7d8cc4" : "#ded9c9"} />
            <text
              x={p.x + (p.x >= cx ? 12 : -12)}
              y={p.y + 4}
              textAnchor={p.x >= cx ? "start" : "end"}
              fontSize={12}
              fill="#8b909e"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {p.n.name.length > 26 ? `${p.n.name.slice(0, 25)}…` : p.n.name}
            </text>
          </g>
        ))}
        <circle cx={cx} cy={cy} r={36} fill="#0e1017" stroke="#f4b63f" strokeWidth={2} />
        {centerImage && <image href={centerImage} x={cx - 34} y={cy - 34} width={68} height={68} clipPath="url(#ego-center)" preserveAspectRatio="xMidYMid slice" />}
        <text x={cx} y={cy + 58} textAnchor="middle" fontSize={14} fontWeight={600} fill="#e9e6dc" fontFamily="ui-sans-serif, system-ui, sans-serif">
          {center.name}
        </text>
      </svg>
      <figcaption className="px-4 py-2 text-[11.5px] text-ink-faint">
        {center.name}&apos;s closest collaborators in the graph. Open the app to explore two hops out.
      </figcaption>
    </figure>
  );
}
