/**
 * Open Graph image for a stored answer: posters and arrows on the dark
 * ground, the degrees count, the wordmark. Rendered with next/og (satori).
 */
import { ImageResponse } from "next/og";
import type { AnswerPage } from "./permalink";

export const OG_SIZE = { width: 1200, height: 630 };

const BG = "#07080c";
const INK = "#e9e6dc";
const DIM = "#8b909e";
const ACCENT = "#f4b63f";

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
  // Fit the chain: card width shrinks as the chain grows.
  const cardW = n <= 3 ? 200 : n <= 5 ? 150 : 118;
  const cardH = Math.round(cardW * 1.4);
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
          background: `radial-gradient(ellipse 70% 60% at 50% 40%, rgba(125,140,196,0.14), transparent 70%), ${BG}`,
          color: INK,
          padding: "48px 56px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 28, fontWeight: 700 }}>
            <div style={{ width: 16, height: 16, borderRadius: 999, background: ACCENT, boxShadow: `0 0 18px ${ACCENT}` }} />
            Headshot
          </div>
          <div style={{ fontSize: 24, color: DIM }}>{subtitle}</div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: n <= 3 ? 28 : 14 }}>
          {chain.map((node, i) => (
            <div key={node.imdbId} style={{ display: "flex", alignItems: "center", gap: n <= 3 ? 28 : 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: cardW }}>
                <div
                  style={{
                    width: cardW,
                    height: cardH,
                    borderRadius: 18,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.06)",
                    border: `2px solid ${node.kind === "person" ? ACCENT : "rgba(125,140,196,0.9)"}`,
                    fontSize: cardW / 3,
                    fontWeight: 700,
                    color: DIM,
                  }}
                >
                  {node.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={node.imageUrl} alt="" width={cardW} height={cardH} style={{ objectFit: "cover", width: cardW, height: cardH }} />
                  ) : (
                    initials(node.name)
                  )}
                </div>
                <div style={{ marginTop: 10, fontSize: n <= 3 ? 24 : 18, fontWeight: 600, textAlign: "center", maxWidth: cardW + 20, lineHeight: 1.15 }}>{node.name}</div>
              </div>
              {i < n - 1 && <div style={{ fontSize: n <= 3 ? 40 : 28, color: ACCENT }}>→</div>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", fontSize: 22, color: DIM }}>{page.answer.question.slice(0, 110)}</div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
