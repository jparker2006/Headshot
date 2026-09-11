"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import Sigma from "sigma";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import { inferSettings } from "graphology-layout-forceatlas2";
import { BrainStore, COLORS, type NodeAttrs, type EdgeAttrs } from "./brainStore";

export interface CanvasProps {
  store: BrainStore;
  selected: string | null;
  onClickNode: (imdbId: string) => void;
  onDoubleClickNode: (imdbId: string) => void;
  onClickEdge: (personImdbId: string, titleImdbId: string) => void;
  onClickStage: () => void;
}

const DIM = "rgba(255,255,255,0.06)";
const DIM_EDGE = "rgba(255,255,255,0.025)";
const ALT = "rgba(244,182,63,0.35)";

export default function CanvasInner({ store, selected, onClickNode, onDoubleClickNode, onClickEdge, onClickStage }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma<NodeAttrs, EdgeAttrs> | null>(null);
  const layoutRef = useRef<FA2Layout | null>(null);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const stateRef = useRef(state);
  const selectedRef = useRef(selected);
  useEffect(() => {
    stateRef.current = state;
    selectedRef.current = selected;
  }, [state, selected]);

  // Mount sigma once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const graph = store.graph;
    const sigma = new Sigma<NodeAttrs, EdgeAttrs>(graph, container, {
      allowInvalidContainer: true,
      renderLabels: true,
      labelFont: "var(--font-geist-sans), system-ui, sans-serif",
      labelSize: 12,
      labelWeight: "500",
      labelColor: { color: "#cfd0d6" },
      labelRenderedSizeThreshold: 5,
      labelDensity: 0.45,
      labelGridCellSize: 90,
      defaultEdgeType: "line",
      minCameraRatio: 0.03,
      maxCameraRatio: 40,
      zIndex: true,
      stagePadding: 60,
      enableEdgeEvents: true,
      nodeReducer: (node, data) => {
        const s = stateRef.current;
        const hl = s.highlight;
        const active = hl.pathNodes.size > 0 || hl.altNodes.size > 0 || hl.candidates.size > 0;
        const onPath = hl.pathNodes.has(node);
        const onAlt = hl.altNodes.has(node);
        const isCandidate = hl.candidates.has(node);
        const mine = s.sessionIds.has(node);
        const isSelected = selectedRef.current === node;
        let color = mine ? COLORS.session : data.color;
        let size = data.size;
        let zIndex = 0;
        let forceLabel = false;
        if (active) {
          if (onPath) {
            color = COLORS.accent;
            size = data.size * 1.8 + 3;
            zIndex = 3;
            forceLabel = true;
          } else if (isCandidate) {
            color = COLORS.accent;
            size = data.size * 1.3 + 2;
            zIndex = 2;
            forceLabel = true;
          } else if (onAlt) {
            color = ALT;
            size = data.size * 1.1;
            zIndex = 1;
          } else {
            color = DIM;
          }
        }
        if (isSelected) {
          size = Math.max(size, data.size * 1.6 + 3);
          zIndex = 4;
          forceLabel = true;
          color = COLORS.accent;
        }
        return { ...data, color, size, zIndex, forceLabel, highlighted: isSelected };
      },
      edgeReducer: (edge, data) => {
        const hl = stateRef.current.highlight;
        const active = hl.pathEdges.size > 0 || hl.altEdges.size > 0;
        if (!active) return data;
        if (hl.pathEdges.has(edge)) return { ...data, color: COLORS.accent, size: 2.4, zIndex: 3 };
        if (hl.altEdges.has(edge)) return { ...data, color: ALT, size: 1.2, zIndex: 1 };
        return { ...data, color: DIM_EDGE };
      },
    });
    sigmaRef.current = sigma;
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __headshot?: unknown }).__headshot = { sigma, store };
    }

    sigma.on("clickNode", ({ node }) => onClickNode(node));
    sigma.on("doubleClickNode", ({ node, event }) => {
      event.preventSigmaDefault();
      onDoubleClickNode(node);
    });
    sigma.on("clickEdge", ({ edge }) => {
      const [a, b] = graph.extremities(edge);
      const [person, title] = a.startsWith("nm") ? [a, b] : [b, a];
      onClickEdge(person, title);
    });
    sigma.on("clickStage", () => onClickStage());

    const layout = new FA2Layout(graph, {
      settings: {
        ...inferSettings(graph),
        // LinLog pulls real communities apart instead of one round blob.
        linLogMode: true,
        gravity: 0.35,
        scalingRatio: 10,
        slowDown: 6,
        adjustSizes: true,
        edgeWeightInfluence: 0.6,
      },
      getEdgeWeight: (_e, attrs) => (attrs.source === "overlay" ? 1 : attrs.tier === 1 ? 1 : 0.4),
    });
    layoutRef.current = layout;

    const ro = new ResizeObserver(() => {
      sigma.resize();
      sigma.refresh({ skipIndexation: true });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      layout.kill();
      sigma.kill();
      sigmaRef.current = null;
      layoutRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  // Whenever the store changes: refresh, and let the layout settle for a moment.
  useEffect(() => {
    const sigma = sigmaRef.current;
    const layout = layoutRef.current;
    if (!sigma || !layout) return;
    sigma.refresh({ skipIndexation: false });
    if (store.graph.order > 1) {
      layout.start();
      const big = store.graph.order > 400;
      const t = setTimeout(() => layout.stop(), state.loaded && state.version < 3 ? (big ? 9000 : 4500) : 2200);
      return () => clearTimeout(t);
    }
  }, [state.version, state.loaded, store]);

  // Camera follows the focus.
  // Camera follows the focus: once right away, once more after the layout has settled.
  const focus = state.highlight.focus;
  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma || focus.length === 0) return;
    const t1 = setTimeout(() => focusOn(sigma, focus), 300);
    const t2 = setTimeout(() => focusOn(sigma, focus), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [focus]);

  useEffect(() => {
    sigmaRef.current?.refresh({ skipIndexation: true });
  }, [selected]);

  return <div ref={containerRef} className="absolute inset-0" aria-label="Brain canvas" />;
}

function focusOn(sigma: Sigma<NodeAttrs, EdgeAttrs>, ids: string[]) {
  const graph = sigma.getGraph();
  // Framed-graph coordinates are normalized to the current auto-rescale, so a
  // bbox there is directly comparable to the camera ratio (1 = whole graph).
  const pts = ids
    .filter((id) => graph.hasNode(id))
    .map((id) => sigma.viewportToFramedGraph(sigma.graphToViewport(graph.getNodeAttributes(id))));
  if (pts.length === 0) return;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2;
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const ratio = Math.min(Math.max(span * 1.7, 0.35), 1.3);
  sigma.getCamera().animate({ x, y, ratio, angle: 0 }, { duration: 700 });
}
