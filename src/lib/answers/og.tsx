/**
 * Open Graph image for a stored answer, on board C's ground: the chain as thin
 * poster marks with mono captions, a mono arrow between, the wordmark top-left
 * and the shape of the answer top-right. Rendered with next/og (satori).
 *
 * Fonts: the route loads none. Geist and JetBrains Mono reach the app through
 * `next/font/google`, which hands the browser a stylesheet — satori needs the
 * raw font binary, which would mean a network fetch on every OG render (and a
 * failure mode on a cold, offline or rate-limited build). So this image asks
 * for the platform `sans-serif` and `monospace` instead and keeps everything
 * else — palette, scale, hierarchy — exactly on system. If Geist is ever
 * vendored into the repo as a .ttf, swap it in here via ImageResponse `fonts`.
 */
import { ImageResponse } from "next/og";
import type { AnswerPage } from "./permalink";

export const OG_SIZE = { width: 1200, height: 630 };

// Board C tokens, verbatim.
const BG = "#0d0d0e";
const RAISED = "#1c1c1e";
const INK = "#e6e6e3";
const DIM = "#8b8b87";
const FAINT = "#62625f";
const GHOST = "#3f3f3d";
const LINE = "rgba(230,230,227,0.07)";

const MONO = "monospace";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function ogImageFor(page: AnswerPage): ImageResponse {
  const chain = page.chain.slice(0, 7);
  const n = chain.length;
  // The poster is a marker here too: it shrinks as the chain grows, and the
  // caption column stays wider than the poster so names never wrap to three lines.
  const posterW = n <= 3 ? 132 : n <= 5 ? 104 : 84;
  const posterH = Math.round(posterW * 1.5);
  const colW = Math.max(posterW, n <= 3 ? 220 : n <= 5 ? 168 : 128);
  const nameSize = n <= 3 ? 26 : n <= 5 ? 21 : 17;
  const subtitle =
    page.degrees !== null
      ? `${page.degrees} ${page.degrees === 1 ? "degree" : "degrees"} apart`
      : page.answer.shape === "both"
        ? "who was in both"
        : page.answer.shape === "costar"
          ? "worked together"
          : "known for";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: INK,
          padding: "44px 56px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: `1px solid ${LINE}`, paddingBottom: 16 }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>headshot</div>
          <div style={{ display: "flex", fontSize: 20, color: GHOST, fontFamily: MONO }}>{subtitle}</div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: n <= 3 ? 24 : 16 }}>
          {chain.map((node, i) => (
            <div key={node.imdbId} style={{ display: "flex", alignItems: "center", gap: n <= 3 ? 24 : 16 }}>
              <div style={{ display: "flex", flexDirection: "column", width: colW, gap: 12 }}>
                <div
                  style={{
                    width: posterW,
                    height: posterH,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: RAISED,
                    fontSize: posterW / 3,
                    fontWeight: 600,
                    color: FAINT,
                  }}
                >
                  {node.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={node.imageUrl} alt="" width={posterW} height={posterH} style={{ objectFit: "cover", width: posterW, height: posterH }} />
                  ) : (
                    initials(node.name)
                  )}
                </div>
                <div style={{ display: "flex", fontSize: nameSize, fontWeight: 500, color: INK, lineHeight: 1.2 }}>{node.name}</div>
                <div style={{ display: "flex", fontSize: 17, color: GHOST, fontFamily: MONO }}>
                  {node.kind === "title" ? (node.year ? `${node.year} · title` : "title") : "person"}
                </div>
              </div>
              {i < n - 1 && <div style={{ display: "flex", fontSize: 22, color: GHOST, fontFamily: MONO }}>→</div>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", fontSize: 24, color: DIM, borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>{page.answer.question.slice(0, 110)}</div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
