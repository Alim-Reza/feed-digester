/**
 * Unloads a model from Ollama's memory immediately (`keep_alive: 0`, CLAUDE.md's memory-
 * budget ground rule) via a raw request to `/api/generate` with no prompt — the documented way
 * to force an unload, and works for a model regardless of whether it was loaded through the
 * chat or embedding endpoint (Ollama's model loading is per-model, not per-API-surface).
 * Shared by `ollamaProvider.ts` and `ollamaEmbedder.ts` rather than setting `keep_alive: 0` on
 * every individual call, which would reload the model between every single request in a batch.
 */
export async function unloadOllamaModel(host: string, model: string): Promise<void> {
  try {
    await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, keep_alive: 0 }),
    });
  } catch {
    // best-effort — if Ollama is already unreachable there's nothing to unload
  }
}
