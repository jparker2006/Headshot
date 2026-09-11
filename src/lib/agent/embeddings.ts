/**
 * Embeddings for fuzzy resolution (v2). The OpenRouter provider has no
 * `dimensions` option, so vectors are truncated to EMBEDDING_DIMS and
 * re-normalized (the text-embedding-3 family is trained for exactly that),
 * matching the fixed pgvector column width.
 */
import { embed, embedMany, type EmbeddingModel } from "ai";
import type { IndustryGraph, NodeInfo } from "@/lib/graph/engine";
import { EMBEDDING_DIMS } from "@/lib/brain/schema";

/** Truncate to `dims` and L2-normalize. Shorter inputs are zero-padded. */
export function trimEmbedding(vec: number[], dims = EMBEDDING_DIMS): number[] {
  const out = vec.slice(0, dims);
  while (out.length < dims) out.push(0);
  let norm = 0;
  for (const x of out) norm += x * x;
  norm = Math.sqrt(norm);
  return norm === 0 ? out : out.map((x) => x / norm);
}

/**
 * The text that stands for an entity: name, kind, year, genres, and its most
 * prominent credits with characters. Kept under ~400 chars so 50k entities
 * embed cheaply and the vector is about the entity, not its filmography.
 */
export function entityText(graph: IndustryGraph, node: NodeInfo, maxCredits = 8): string {
  const cast = graph.castOf(node.id).slice(0, maxCredits);
  if (node.kind === "person") {
    const credits = cast.map((c) => `${c.node.name}${c.node.year ? ` (${c.node.year})` : ""}${c.character ? ` as ${c.character}` : ""}`);
    return `${node.name}. Actor or filmmaker${node.year ? `, born ${node.year}` : ""}. Known for: ${credits.join("; ")}.`.slice(0, 600);
  }
  const genres = node.genres ? node.genres.split(",").join(", ") : "";
  const people = cast.map((c) => `${c.node.name}${c.character ? ` as ${c.character}` : ""}`);
  return `${node.name}${node.year ? ` (${node.year})` : ""}. ${node.titleType || "title"}${genres ? `, ${genres}` : ""}. Cast: ${people.join("; ")}.`.slice(0, 600);
}

export type EmbedFn = (text: string) => Promise<number[]>;

export function embedderFor(model: EmbeddingModel, dims = EMBEDDING_DIMS): EmbedFn {
  return async (text) => trimEmbedding((await embed({ model, value: text })).embedding, dims);
}

export async function embedBatch(model: EmbeddingModel, values: string[], dims = EMBEDDING_DIMS): Promise<number[][]> {
  if (values.length === 0) return [];
  const { embeddings } = await embedMany({ model, values });
  return embeddings.map((e) => trimEmbedding(e, dims));
}
