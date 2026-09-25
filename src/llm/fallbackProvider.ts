import type { GenerateObjectParams, LLMProvider } from './types';
import type { Logger } from '../logging';

/**
 * Wraps a primary `LLMProvider` (Ollama) with an optional secondary (Groq) per grill F4:
 * - `generateText`: falls back once if the primary is unreachable.
 * - `generateObject`: retries the primary up to `maxSchemaRetries` times (default 2 — "fails
 *   schema validation twice") before falling back, since a bad structured-output attempt is
 *   often just noise, not a real outage.
 *
 * With no fallback configured (`fallback: null` — Groq disabled by default), this just
 * reproduces the primary's own errors instead of swallowing them silently.
 */
export function createFallbackLLMProvider(opts: {
  primary: LLMProvider;
  fallback: LLMProvider | null;
  logger: Logger;
  maxSchemaRetries?: number;
}): LLMProvider {
  const { primary, fallback, logger } = opts;
  const maxSchemaRetries = opts.maxSchemaRetries ?? 2;

  return {
    name: primary.name,

    async generateText(params) {
      try {
        return await primary.generateText(params);
      } catch (err) {
        if (!fallback) throw err;
        logger.warn(
          { err, primary: primary.name, fallback: fallback.name },
          'llm: primary generateText failed, falling back',
        );
        return await fallback.generateText(params);
      }
    },

    async generateObject<T>(params: GenerateObjectParams<T>): Promise<T> {
      let lastErr: unknown;
      for (let attempt = 1; attempt <= maxSchemaRetries; attempt += 1) {
        try {
          return await primary.generateObject(params);
        } catch (err) {
          lastErr = err;
          logger.warn(
            { attempt, maxSchemaRetries, err, primary: primary.name },
            'llm: primary generateObject attempt failed',
          );
        }
      }
      if (!fallback) throw lastErr;
      logger.warn(
        { err: lastErr, primary: primary.name, fallback: fallback.name },
        'llm: falling back to secondary provider after repeated schema-validation failures',
      );
      return await fallback.generateObject(params);
    },

    async release() {
      await primary.release();
      if (fallback) await fallback.release();
    },
  };
}
