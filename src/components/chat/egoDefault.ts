/**
 * Ego view by default (v2 chunk D): after an answer, the right panel centers
 * on the first person in the question. Pure rule over the assistant message's
 * parts: the chosen path's first person, else the first person node touched.
 * A face grid with no chosen path keeps the whole brain (the candidates are lit).
 */
import type { HeadshotUIMessage } from "@/lib/agent/events";

export function egoDefaultFor(parts: HeadshotUIMessage["parts"]): string | null {
  const chosen = parts.find((p) => p.type === "data-chosen");
  if (chosen && chosen.type === "data-chosen") {
    const person = chosen.data.path.imdbIds.find((id) => id.startsWith("nm"));
    if (person) return person;
  }
  if (parts.some((p) => p.type === "data-faces")) return null;
  for (const p of parts) if (p.type === "data-node" && p.data.kind === "person") return p.data.imdbId;
  return null;
}

/** How long the path animation needs before the panel switches to the ego view. */
export function egoDelayMs(parts: HeadshotUIMessage["parts"]): number {
  const hops = parts.filter((p) => p.type === "data-path-hop").length;
  return hops > 0 ? 380 * hops + 900 : 300;
}
