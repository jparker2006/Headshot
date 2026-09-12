/**
 * The rail's glyphs, traced from `design/boards-v5/Shell.dc.html`: 16px
 * monoline strokes at 1.3, `currentColor` so the ink level carries the state
 * (DESIGN.md → Sidebar (v5)). The phone tab bar draws the same paths at 19px.
 */
import type { NavKey } from "./navModel";

const COMMON = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** log / ask / you — the three sections. Signed out, `sign-in` has no glyph. */
export function SectionIcon({ name, size = 16 }: { name: NavKey; size?: number }) {
  if (name === "sign-in") return <span style={{ width: size, height: size }} aria-hidden />;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...COMMON} aria-hidden>
      {name === "log" && <path d="M2.6 4h10.8M2.6 8h10.8M2.6 12h6.8" />}
      {name === "ask" && <path d="M13.6 9.2a1.8 1.8 0 0 1-1.8 1.8H5.9L2.4 13.6V4.2a1.8 1.8 0 0 1 1.8-1.8h7.6a1.8 1.8 0 0 1 1.8 1.8z" />}
      {name === "you" && (
        <>
          <circle cx="8" cy="5.6" r="2.6" />
          <path d="M3 13.4c0-2.3 2.2-3.6 5-3.6s5 1.3 5 3.6" />
        </>
      )}
    </svg>
  );
}

/** The `+` in front of `new chat`, and on the phone's top bar. */
export function PlusIcon({ size = 12 }: { size?: number }) {
  const h = size / 2;
  const arm = size * 0.35;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} {...COMMON} aria-hidden>
      <path d={`M${h} ${h - arm}v${arm * 2}M${h - arm} ${h}h${arm * 2}`} />
    </svg>
  );
}

/** The sliders glyph on the account row. Board C's only settings mark. */
export function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...COMMON} aria-hidden>
      <path d="M2.2 4.4h11.6M2.2 11.6h11.6" />
      <circle cx="6" cy="4.4" r="1.7" fill="var(--bg)" />
      <circle cx="10.4" cy="11.6" r="1.7" fill="var(--bg)" />
    </svg>
  );
}
