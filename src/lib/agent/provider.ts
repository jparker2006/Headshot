import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel, EmbeddingModel } from "ai";

/** OpenRouter is the single provider. Model ids come from env, never code. */
export function openrouterFromEnv() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return createOpenRouter({
    apiKey,
    headers: { "HTTP-Referer": "https://headshot.app", "X-Title": "Headshot" },
  });
}

export function chatModelFromEnv(): LanguageModel {
  const id = process.env.HEADSHOT_MODEL ?? "deepseek/deepseek-v4.1-flash";
  return openrouterFromEnv().chat(id);
}

export function embeddingModelFromEnv(): EmbeddingModel {
  const id = process.env.HEADSHOT_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
  return openrouterFromEnv().textEmbeddingModel(id);
}

export function embeddingDims(): number {
  return Number(process.env.HEADSHOT_EMBEDDING_DIMS ?? 512);
}
