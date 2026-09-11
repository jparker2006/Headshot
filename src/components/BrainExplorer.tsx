"use client";
/**
 * The whole-brain canvas, full screen. Reachable at /brain only; the product
 * no longer shows the graph by default.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { BrainStore } from "./canvas/brainStore";
import { BrainPanel } from "./BrainPanel";
import type { RenderedBrain } from "@/lib/brain/render";
import type { EgoNetwork } from "@/lib/graph/ego";

export function BrainExplorer() {
  const router = useRouter();
  const store = useMemo(() => new BrainStore(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [selected, setSelected] = useState<string | null>(null);
  const [ego, setEgo] = useState<EgoNetwork | null>(null);
  const [egoImages, setEgoImages] = useState<Record<string, string | null>>({});

  useEffect(() => {
    fetch("/api/brain", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: RenderedBrain | null) => b && store.load(b))
      .catch(() => {});
  }, [store]);

  const select = useCallback(
    (id: string) => {
      setSelected(id);
      fetch(`/api/ego/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((e: EgoNetwork | null) => {
          if (!e) return;
          setEgo(e);
          const ids = e.nodes.filter((n) => n.ring <= 1).map((n) => n.imdbId).slice(0, 40);
          fetch(`/api/enrich?ids=${ids.join(",")}`)
            .then((r) => r.json())
            .then((d: { images: Record<string, { url: string | null }> }) => setEgoImages((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(d.images).map(([k, v]) => [k, v.url])) })))
            .catch(() => {});
        })
        .catch(() => {});
    },
    [],
  );

  return (
    <div className="h-full w-full">
      <BrainPanel
        store={store}
        state={state}
        selected={selected}
        onSelect={select}
        onDeselect={() => setSelected(null)}
        onExpand={select}
        onAsk={(text) => router.push(`/?q=${encodeURIComponent(text)}`)}
        onPick={select}
        ego={ego}
        egoImages={egoImages}
        onExitEgo={() => {
          setEgo(null);
          setSelected(null);
        }}
        onClose={() => router.push("/")}
      />
    </div>
  );
}
