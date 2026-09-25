import defaults from '../../digest.config';
import { digestConfigSchema, type DigestConfig, type DigestConfigOverrides } from './schema';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeOverrides<T extends object>(base: T, overrides: object | undefined): T {
  if (!overrides) return base;
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    const existing = result[key];
    result[key] =
      isPlainObject(existing) && isPlainObject(value) ? { ...existing, ...value } : value;
  }
  return result as T;
}

function envOverrides(): DigestConfigOverrides {
  const overrides: DigestConfigOverrides = {};
  if (process.env.DATA_DIR) {
    overrides.dataDir = process.env.DATA_DIR;
  }
  if (process.env.OLLAMA_HOST) {
    overrides.models = { ollamaHost: process.env.OLLAMA_HOST };
  }
  if (process.env.GROQ_API_KEY) {
    overrides.groq = { ...(overrides.groq ?? {}), enabled: true };
  }
  return overrides;
}

/**
 * Loads the digest config: typed defaults, then environment variables, then any
 * caller-supplied overrides (e.g. rows from the `settings` table once it exists).
 * The result is validated and frozen so nothing downstream can mutate shared config.
 */
export function loadConfig(overrides?: DigestConfigOverrides): DigestConfig {
  let config: DigestConfig = defaults;
  config = mergeOverrides(config, envOverrides());
  config = mergeOverrides(config, overrides);
  const parsed = digestConfigSchema.parse(config);
  return Object.freeze(parsed);
}

export type { DigestConfig, DigestConfigOverrides, CategoryId, CategoryConfig } from './schema';
