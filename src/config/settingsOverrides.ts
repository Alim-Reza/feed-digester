import { z } from 'zod';
import type { Repositories } from '../db/repositories';
import { digestConfigSchema, type DigestConfigOverrides } from './schema';

const overrideKeys = Object.keys(digestConfigSchema.shape) as (keyof DigestConfigOverrides)[];

type WarnFn = (key: string, issues: string) => void;

/**
 * Builds `loadConfig`'s override argument from the `settings` table — one row per top-level
 * `DigestConfig` key (e.g. `settings.get('thresholds')` is a `Partial<Thresholds>`). Per grill
 * I1/J13: defaults live in `digest.config.ts`, and edits made in the UI are stored here and
 * override the file. Read once at process startup (`worker/main.ts`, `web/context.ts`) — a
 * setting changed through the UI takes effect on the next worker restart, not mid-run; nothing
 * in the pipeline re-reads config once a run starts.
 *
 * Each row is validated against that key's own (partial, for object sections) schema before
 * being trusted — a malformed row (a bad manual edit, a future migration, a form bug that wrote
 * `NaN`) is dropped with a warning instead of making `digestConfigSchema.parse()` throw and
 * crash the whole process on startup; the file default for that section is used instead.
 */
export function loadSettingsOverrides(
  repos: Repositories,
  warn: WarnFn = (key, issues) => console.warn(`settings: ignoring invalid override for "${key}": ${issues}`),
): DigestConfigOverrides {
  const overrides: DigestConfigOverrides = {};
  for (const key of overrideKeys) {
    const raw = repos.settings.get(key);
    if (raw === undefined) continue;

    const fieldSchema = digestConfigSchema.shape[key];
    const validator = fieldSchema instanceof z.ZodObject ? fieldSchema.partial() : fieldSchema;
    const result = validator.safeParse(raw);
    if (!result.success) {
      warn(key, z.prettifyError(result.error));
      continue;
    }
    (overrides as Record<string, unknown>)[key] = result.data;
  }
  return overrides;
}
