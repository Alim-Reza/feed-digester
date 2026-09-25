import type { DigestConfig } from '../config/schema';
import type { Logger } from '../logging';
import type { LLMProvider, Embedder } from './types';
import { createOllamaLLMProvider } from './ollamaProvider';
import { createOllamaEmbedder } from './ollamaEmbedder';
import { createGroqLLMProvider } from './groqProvider';
import { createFallbackLLMProvider } from './fallbackProvider';

/**
 * Wires up the real `LLMProvider` for a stage: Ollama primary, Groq fallback only when
 * `config.groq.enabled` (grill F4/Q13 default: off) *and* `GROQ_API_KEY` is actually set —
 * `config/index.ts`'s `envOverrides()` already flips `groq.enabled` on when the env var is
 * present, but this checks the key directly too so a config-only `enabled: true` with no key
 * configured doesn't fail at call time instead of at startup.
 */
export function createLLMProvider(config: DigestConfig, logger: Logger): LLMProvider {
  const primary = createOllamaLLMProvider({
    host: config.models.ollamaHost,
    model: config.models.llm,
  });
  const apiKey = process.env.GROQ_API_KEY;
  const fallback =
    config.groq.enabled && apiKey
      ? createGroqLLMProvider({ apiKey, model: config.groq.model })
      : null;
  return createFallbackLLMProvider({ primary, fallback, logger });
}

export function createEmbedder(config: DigestConfig): Embedder {
  return createOllamaEmbedder({ host: config.models.ollamaHost, model: config.models.embedding });
}

export type { LLMProvider, Embedder, GenerateTextParams, GenerateObjectParams } from './types';
