"use client";
/** Posters and headshots for a list of IMDb ids via /api/enrich, cached for the tab's lifetime. */
import { useEffect, useState } from "react";

type ImageMap = Record<string, { url: string | null }>;
const imageCache = new Map<string, { url: string | null }>();

export function useImages(ids: string[]): ImageMap {
  const key = ids.join(",");
  const [images, setImages] = useState<ImageMap>(() => Object.fromEntries(ids.filter((id) => imageCache.has(id)).map((id) => [id, imageCache.get(id)!])));
  useEffect(() => {
    const missing = key.split(",").filter((id) => id && !imageCache.has(id));
    if (missing.length === 0) return;
    let alive = true;
    fetch(`/api/enrich?ids=${missing.join(",")}`)
      .then((r) => r.json())
      .then((d: { images: ImageMap }) => {
        for (const [id, v] of Object.entries(d.images)) imageCache.set(id, v);
        if (alive) setImages((prev) => ({ ...prev, ...d.images }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  return images;
}

