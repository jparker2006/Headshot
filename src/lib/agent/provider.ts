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

/**
 * The cheap model behind the background jobs (memory rewrite, episode
 * extraction). DeepSeek Flash by default, reasoning turned off at the call
 * site. Null when there is no key, or in keyless dev: those jobs then skip.
 */
export function memoryModelFromEnv(): LanguageModel | null {
  if (!process.env.OPENROUTER_API_KEY || mockAgentEnabled()) return null;
  const id = process.env.HEADSHOT_MEMORY_MODEL ?? process.env.HEADSHOT_MODEL ?? "deepseek/deepseek-v4.1-flash";
  return openrouterFromEnv().chat(id);
}

/** True when HEADSHOT_MOCK_AGENT=1: dev runs a scripted model instead of OpenRouter. */
export function mockAgentEnabled(): boolean {
  return process.env.HEADSHOT_MOCK_AGENT === "1" && process.env.NODE_ENV !== "production";
}

export function embeddingModelFromEnv(): EmbeddingModel {
  const id = process.env.HEADSHOT_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
  return openrouterFromEnv().textEmbeddingModel(id);
}

export function embeddingDims(): number {
  return Number(process.env.HEADSHOT_EMBEDDING_DIMS ?? 512);
}
