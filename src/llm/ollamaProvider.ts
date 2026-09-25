import { generateText, generateObject } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LLMProvider } from './types';
import { unloadOllamaModel } from './ollamaUnload';

/** Real, Ollama-backed `LLMProvider`. Not unit tested directly (needs a running Ollama with a model loaded); the retry/fallback logic that wraps this is tested against fakes in `fallbackProvider.test.ts`. */
export function createOllamaLLMProvider(opts: { host: string; model: string }): LLMProvider {
  const provider = createOllama({ baseURL: `${opts.host}/api` });
  const model = provider.chat(opts.model);

  return {
    name: `ollama:${opts.model}`,

    async generateText({ prompt, system }) {
      const { text } = await generateText({ model, prompt, system });
      return text;
    },

    async generateObject({ schema, prompt, system }) {
      const { object } = await generateObject({ model, schema, prompt, system });
      return object;
    },

    release: () => unloadOllamaModel(opts.host, opts.model),
  };
}
