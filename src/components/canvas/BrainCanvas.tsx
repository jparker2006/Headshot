"use client";
import dynamic from "next/dynamic";
import type { CanvasProps } from "./CanvasInner";

/** sigma needs WebGL and the DOM, so the real canvas is client-only. */
const CanvasInner = dynamic(() => import("./CanvasInner"), {
  ssr: false,
  loading: () => <div className="absolute inset-0" />,
});

export function BrainCanvas(props: CanvasProps) {
  return <CanvasInner {...props} />;
}
