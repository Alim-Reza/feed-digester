import { embedMany } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import type { Embedder } from './types';
import { unloadOllamaModel } from './ollamaUnload';

/**
 * Real, Ollama-backed `Embedder` (`embeddinggemma` by default — see `digest.config.ts`). Not
 * unit tested directly (needs a running Ollama with the embedding model pulled). Deliberately
 * doesn't set `keepAlive` per call — that would reload the model between every text in a batch
 * — instead the model stays loaded for the whole stage and `release()` unloads it at the end.
 */
export function createOllamaEmbedder(opts: { host: string; model: string }): Embedder {
  const provider = createOllama({ baseURL: `${opts.host}/api` });
  const model = provider.textEmbeddingModel(opts.model);

  return {
    name: `ollama:${opts.model}`,

    async embed(texts) {
      const { embeddings } = await embedMany({ model, values: texts });
      return embeddings;
    },

    release: () => unloadOllamaModel(opts.host, opts.model),
  };
}
