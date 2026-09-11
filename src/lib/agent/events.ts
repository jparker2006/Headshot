/**
 * The event vocabulary between the agent and the canvas. Every entry is a
 * custom UI data part (`data-<name>`) streamed alongside the model's text.
 * The canvas animates these live; the chat renders the text.
 */
import type { UIMessage } from "ai";
import type { NodeKind, TitleType } from "@/lib/graph/format";

export interface CanvasNode {
  imdbId: string;
  name: string;
  kind: NodeKind;
  titleType: TitleType | "";
  year: number;
  votes: number;
  genres: string;
  inIndustryGraph: boolean;
  posterUrl?: string;
}

export interface CanvasEdge {
  personImdbId: string;
  titleImdbId: string;
  tier: number;
}

export interface NamedPath {
  /** IMDb ids, source first, alternating person/title. */
  imdbIds: string[];
  names: string[];
}

export interface PathsFound {
  from: string;
  to: string;
  /** True Bacon number (full graph). Null if disconnected. */
  baconNumber: number | null;
  strong: { baconNumber: number; paths: NamedPath[]; truncated: boolean } | null;
  full: { baconNumber: number; paths: NamedPath[]; truncated: boolean } | null;
  differ: boolean;
}

export type HeadshotDataParts = {
  /** Candidate entities while the agent is still deciding who the user means. */
  candidates: { query: string; candidates: CanvasNode[] };
  /** A node entered the brain (or is being referenced). */
  node: CanvasNode;
  /** An edge entered the brain (or is being referenced). */
  edge: CanvasEdge;
  /** All tied shortest paths the engine found. */
  paths: PathsFound;
  /** One hop of the path the agent chose, in order. */
  "path-hop": { from: string; to: string; via: string | null; index: number; total: number; tier: "strong" | "full" };
  /** Which of the tied paths the agent chose to narrate. */
  chosen: { from: string; to: string; tier: "strong" | "full"; index: number; reason: string; path: NamedPath };
  /** A wiki page was written or revised. */
  page: { imdbId: string; question: string; revision: number };
  /** The canvas should center on these nodes. */
  focus: { imdbIds: string[] };
  /** Model-suggested follow-up questions, sent after the answer. */
  followups: { questions: string[] };
  /** Transient status line ("Searching TMDB for…"). */
  status: { text: string };
};

export type HeadshotUIMessage = UIMessage<never, HeadshotDataParts>;

/** Anything that can accept canvas events. The UI stream writer in production; an array in tests. */
export interface CanvasEmitter {
  emit<K extends keyof HeadshotDataParts>(type: K, data: HeadshotDataParts[K], opts?: { transient?: boolean }): void;
}

export type EmitFn = CanvasEmitter["emit"];

export class ArrayEmitter implements CanvasEmitter {
  events: { type: keyof HeadshotDataParts; data: unknown }[] = [];
  emit<K extends keyof HeadshotDataParts>(type: K, data: HeadshotDataParts[K]) {
    this.events.push({ type, data });
  }
}
