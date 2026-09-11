"use client";
/**
 * The path is the graphic — board C's version of it: a thin left-to-right
 * chain of poster and headshot marks joined by a mono arrow, the role under
 * the arrow in mono, names in Geist under each mark. No cards, no rings, no
 * accent (the accent means Play and nothing else), no uppercase labels. Tied
 * alternatives sit behind a quiet `.t-link`.
 */
import { useEffect, useState } from "react";
import type { HeadshotDataParts, NamedPath, PathsFound } from "@/lib/agent/events";
import { useImages } from "./useImages";

interface Props {
  paths: PathsFound;
  chosen: HeadshotDataParts["chosen"] | null;
  onSelectNode: (id: string) => void;
}

const roleCache = new Map<string, Record<string, string>>();
function useRoles(ids: string[]): Record<string, string> {
  const key = ids.join(",");
  const [roles, setRoles] = useState<Record<string, string>>(() => roleCache.get(key) ?? {});
  useEffect(() => {
    if (!key || roleCache.has(key)) return;
    let alive = true;
    fetch(`/api/roles?path=${key}`)
      .then((r) => r.json())
      .then((d: { roles: Record<string, string> }) => {
        roleCache.set(key, d.roles);
        if (alive) setRoles(d.roles);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  return roles;
}

export function PathGraphic({ paths, chosen, onSelectNode }: Props) {
  const shortest = paths.full?.paths[0];
  const lit = chosen?.path ?? shortest;
  const alternates = [...(paths.strong?.paths ?? []), ...(paths.full?.paths ?? [])]
    .filter((p) => !lit || p.imdbIds.join() !== lit.imdbIds.join())
    .filter((p, i, arr) => arr.findIndex((q) => q.imdbIds.join() === p.imdbIds.join()) === i)
    .slice(0, 4);
  const ids = lit ? lit.imdbIds : [];
  const images = useImages(ids);
  const roles = useRoles(ids);

  if (!lit) {
    return <p className="t-prose">no connection in the graph.</p>;
  }
  const hops = lit.imdbIds.filter((id) => id.startsWith("tt")).length;
  const tied = paths.full?.paths.length ?? 0;

  return (
    <figure className="rise m-0 flex flex-col">
      <span className="t-meta pb-[10px]">
        {paths.baconNumber} {paths.baconNumber === 1 ? "degree" : "degrees"} apart
        {hops !== paths.baconNumber && ` · shown route ${hops} hops`}
        {tied > 1 && ` · ${tied} tied`}
      </span>

      <div className="scrollbar-thin overflow-x-auto">
        <div className="flex items-start gap-[10px] pb-1">
          {lit.imdbIds.map((id, i) => {
            const prev = lit.imdbIds[i - 1];
            // The role label belongs to the person→title pair on either side of this arrow.
            const pairKey = prev ? (prev.startsWith("nm") ? `${prev}|${id}` : `${id}|${prev}`) : "";
            return (
              <div key={id + i} className="flex items-start gap-[10px]">
                {i > 0 && <Arrow label={roles[pairKey]} />}
                <Mark name={lit.names[i]} image={images[id]?.url} onClick={() => onSelectNode(id)} />
              </div>
            );
          })}
        </div>
      </div>

      {chosen?.reason && <figcaption className="t-reason pt-[10px]">{chosen.reason}</figcaption>}

      {alternates.length > 0 && (
        <details className="group pt-[10px]">
          <summary className="t-link inline-block list-none">
            {alternates.length} other {alternates.length === 1 ? "route" : "routes"}
          </summary>
          <ul className="m-0 flex list-none flex-col gap-[6px] p-0 pt-[8px]">
            {alternates.map((p) => (
              <li key={p.imdbIds.join()}>
                <AltChain path={p} onSelectNode={onSelectNode} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </figure>
  );
}

function Mark({ name, image, onClick }: { name: string; image?: string | null; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-[88px] shrink-0 flex-col items-start gap-[7px] text-left" title={name}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="poster-mark poster-mark-lg" loading="lazy" />
      ) : (
        <span className="poster-mark poster-mark-lg flex items-center justify-center text-[11px] font-medium text-ink-faint">{initials(name)}</span>
      )}
      <span className="text-[12.5px] font-medium leading-[1.25] text-ink">{name}</span>
    </button>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex w-[64px] shrink-0 flex-col items-center gap-[6px] pt-[18px]">
      <span className="font-mono text-[11.5px] leading-none text-ink-faint" aria-hidden>
        →
      </span>
      {label && <span className="t-meta text-center">{label}</span>}
    </div>
  );
}

function AltChain({ path, onSelectNode }: { path: NamedPath; onSelectNode: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[6px] gap-y-[2px] text-[12.5px] text-ink-dim">
      {path.names.map((n, i) => (
        <span key={path.imdbIds[i] + i} className="flex items-center gap-[6px]">
          {i > 0 && (
            <span className="font-mono text-[11.5px] text-ink-ghost" aria-hidden>
              →
            </span>
          )}
          <button onClick={() => onSelectNode(path.imdbIds[i])} className="entity-link entity-link-soft">
            {n}
          </button>
        </span>
      ))}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
