/**
 * Static ego view for permalinks: the center with its first ring on a circle,
 * server-rendered SVG so the page needs no canvas or JavaScript to show it.
 *
 * Board C: the canvas colours (`--person` / `--title` / `--session`) belong to
 * the sigma graph and are not used on a v4 screen, so every mark here is ink at
 * a fixed alpha — a title reads louder than a person by weight, not by hue. No
 * box around it either: the caption is the only thing under it.
 */
import type { EgoNetwork } from "@/lib/graph/ego";

const INK = "#e6e6e3";
const DIM = "#8b8b87";
const FAINT = "#62625f";

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
    <figure className="scrollbar-thin m-0 flex flex-col gap-[8px] overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${center.name} and ${ring.length} closest collaborators`} className="h-auto w-full min-w-[520px] font-sans">
        <defs>
          <clipPath id="ego-center">
            <circle cx={cx} cy={cy} r={30} />
          </clipPath>
        </defs>
        {pts.map((p) => (
          <line key={`l-${p.n.imdbId}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={INK} strokeOpacity={p.n.kind === "title" ? 0.16 : 0.1} strokeWidth={1} />
        ))}
        {pts.map((p) => (
          <g key={p.n.imdbId}>
            <circle cx={p.x} cy={p.y} r={p.n.kind === "title" ? 4 : 3} fill={INK} fillOpacity={p.n.kind === "title" ? 0.55 : 0.3} />
            <text
              x={p.x + (p.x >= cx ? 10 : -10)}
              y={p.y + 4}
              textAnchor={p.x >= cx ? "start" : "end"}
              fontSize={12}
              fill={p.n.kind === "title" ? DIM : FAINT}
            >
              {p.n.name.length > 26 ? `${p.n.name.slice(0, 25)}…` : p.n.name}
            </text>
          </g>
        ))}
        <circle cx={cx} cy={cy} r={31} fill="#0d0d0e" stroke={INK} strokeOpacity={0.16} strokeWidth={1} />
        {centerImage && <image href={centerImage} x={cx - 30} y={cy - 30} width={60} height={60} clipPath="url(#ego-center)" preserveAspectRatio="xMidYMid slice" />}
        <text x={cx} y={cy + 52} textAnchor="middle" fontSize={14} fontWeight={600} fill={INK}>
          {center.name}
        </text>
      </svg>
      <figcaption className="t-meta">the closest collaborators in the graph. open the app to explore two hops out.</figcaption>
    </figure>
  );
}
