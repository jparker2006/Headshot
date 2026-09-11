"use client";
import type { ReactNode } from "react";
import { type EntityIndex, looksLikeName, resolveEntity } from "./entityLinks";

interface Props {
  text: string;
  /** Names → ids from the message; emphasized names that match become links. */
  entities?: EntityIndex;
  onSelectNode?: (imdbId: string) => void;
  /** Called for an emphasized name that is not in the index; resolves via search. */
  onLookup?: (name: string) => void;
}

/**
 * Tiny markdown: paragraphs, **bold**, *emphasis*, `code`, and → arrows kept
 * as-is. Emphasized entity names become links ("cursor for movies") — ink and
 * weight, never the accent. Paragraphs carry the bubble's voice (Geist 14 /
 * 1.52 at --ink-dim) and sit 11px apart, per board C.
 */
export function Markdown({ text, entities, onSelectNode, onLookup }: Props) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const link = (name: string, node: ReactNode, key: number): ReactNode => {
    if (!onSelectNode) return node;
    const hit = entities ? resolveEntity(entities, name) : null;
    if (hit) {
      return (
        <button key={key} type="button" onClick={() => onSelectNode(hit.imdbId)} className="entity-link" data-kind={hit.kind} title={`Open ${hit.name}`}>
          {node}
        </button>
      );
    }
    if (onLookup && looksLikeName(name)) {
      return (
        <button key={key} type="button" onClick={() => onLookup(name)} className="entity-link entity-link-soft" title={`Look up ${name}`}>
          {node}
        </button>
      );
    }
    return node;
  };
  return (
    <div className="prose-headshot text-[14px] leading-[1.52] text-ink-dim">
      {paragraphs.map((p, i) => (
        <p key={i}>{inline(p, link)}</p>
      ))}
    </div>
  );
}

type Linker = (name: string, node: ReactNode, key: number) => ReactNode;

function inline(text: string, link: Linker): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(lines(text.slice(last, m.index), k++));
    const tok = m[0];
    if (tok.startsWith("**")) {
      const name = tok.slice(2, -2);
      out.push(link(name, <strong key={k++}>{name}</strong>, k++));
    } else if (tok.startsWith("`")) out.push(<code key={k++} className="font-mono text-[13px] text-ink">{tok.slice(1, -1)}</code>);
    else {
      const name = tok.slice(1, -1);
      out.push(link(name, <em key={k++}>{name}</em>, k++));
    }
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
