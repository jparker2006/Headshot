"use client";
/** Title names and years for a list of IMDb ids via /api/names, cached for the tab's lifetime. */
import { useEffect, useState } from "react";

export interface NamedTitle {
  name: string;
  year: number;
}

const nameCache = new Map<string, NamedTitle>();

export function useNames(ids: string[]): Record<string, NamedTitle> {
  const key = ids.join(",");
  const [names, setNames] = useState<Record<string, NamedTitle>>({});
  useEffect(() => {
    const missing = key.split(",").filter((id) => id && !nameCache.has(id));
    if (missing.length === 0) return;
    let alive = true;
    fetch(`/api/names?ids=${missing.join(",")}`)
      .then((r) => r.json())
      .then((d: { names: Record<string, NamedTitle> }) => {
        for (const [id, v] of Object.entries(d.names)) nameCache.set(id, v);
        if (alive) setNames((prev) => ({ ...prev, ...d.names }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  // Merge the tab-wide cache at render time, so a caller whose ids were all
  // fetched elsewhere still sees them without running the effect.
  const out: Record<string, NamedTitle> = { ...names };
  for (const id of ids) {
    const c = nameCache.get(id);
    if (c && !out[id]) out[id] = c;
  }
  return out;
}
