import type { z } from 'zod';

export type GenerateTextParams = {
  prompt: string;
  system?: string;
};

export type GenerateObjectParams<T> = {
  schema: z.ZodType<T>;
  prompt: string;
  system?: string;
};

/**
 * Kept as an interface, like `Classifier` and `CollectorDriver`, so callers (summarization,
 * job extraction — slices 8–9) don't depend on Ollama or Groq directly, and the retry/fallback
 * orchestration in `fallbackProvider.ts` is unit testable against fakes.
 */
export interface LLMProvider {
  readonly name: string;
  generateText(params: GenerateTextParams): Promise<string>;
  /** Structured output validated against `schema` — see plan/grill: citations and other structured LLM output must validate, not just be trusted. */
  generateObject<T>(params: GenerateObjectParams<T>): Promise<T>;
  /** Releases the model (Ollama: `keep_alive: 0`). Call once at the end of each LLM stage — see CLAUDE.md's memory-budget ground rule. */
  release(): Promise<void>;
}

export interface Embedder {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
  release(): Promise<void>;
}
