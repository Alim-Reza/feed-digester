import { generateText, generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import type { LLMProvider } from './types';

/**
 * Real, Groq-backed `LLMProvider` — the free-tier fallback (grill F4/F5/F6: free only, no
 * spending cap needed). `release()` is a no-op: Groq is a cloud API with no local memory to
 * free. Not unit tested directly (needs a real API key and network); the fallback-decision
 * logic that decides *when* to reach for this is tested against fakes in
 * `fallbackProvider.test.ts`.
 */
export function createGroqLLMProvider(opts: { apiKey: string; model: string }): LLMProvider {
  const provider = createGroq({ apiKey: opts.apiKey });
  const model = provider.languageModel(opts.model);

  return {
    name: `groq:${opts.model}`,

    async generateText({ prompt, system }) {
      const { text } = await generateText({ model, prompt, system });
      return text;
    },

    async generateObject({ schema, prompt, system }) {
      const { object } = await generateObject({ model, schema, prompt, system });
      return object;
    },

    async release() {},
  };
}
