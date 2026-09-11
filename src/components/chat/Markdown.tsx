"use client";
import type { ReactNode } from "react";

/** Tiny markdown: paragraphs, **bold**, *emphasis*, `code`, and → arrows kept as-is. */
export function Markdown({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return (
    <div className="prose-headshot text-[14.5px] leading-[1.55] text-ink">
      {paragraphs.map((p, i) => (
        <p key={i}>{inline(p)}</p>
      ))}
    </div>
  );
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(lines(text.slice(last, m.index), k++));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k++} className="font-mono text-[13px] text-accent">{tok.slice(1, -1)}</code>);
    else out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(lines(text.slice(last), k++));
  return out;
}

function lines(text: string, key: number): ReactNode {
  const parts = text.split("\n");
  if (parts.length === 1) return text;
  return (
    <span key={key}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {p}
        </span>
      ))}
    </span>
  );
}
