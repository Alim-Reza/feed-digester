'use server';

import { revalidatePath } from 'next/cache';
import { getWebContext } from '@/src/web/context';
import { digestConfigSchema } from '@/src/config/schema';
import type { RunCommandType } from '@/src/db/schema';

/**
 * Validates against the same field schema `loadSettingsOverrides` re-checks on read, before
 * writing — untrusted `FormData` never reaches the `settings` table unvalidated (a bad value
 * would otherwise just get silently dropped later, with no feedback to the person who saved it).
 * Returns `null` (and skips the write) on a validation failure.
 */
function parseSetting(key: 'thresholds' | 'classification' | 'filtering', value: unknown): unknown | null {
  const result = digestConfigSchema.shape[key].partial().safeParse(value);
  return result.success ? result.data : null;
}

/** `web`'s only pipeline-adjacent write: enqueueing a command the worker later claims (CLAUDE.md's ground rule). */
export async function triggerRun(type: RunCommandType) {
  const { repos } = getWebContext();
  repos.runCommands.enqueue(type);
  revalidatePath('/operations');
}

function parseLines(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function updateThresholds(formData: FormData) {
  const parsed = parseSetting('thresholds', {
    relevance: Number(formData.get('relevance')),
    job: Number(formData.get('job')),
    clusterScore: Number(formData.get('clusterScore')),
  });
  if (parsed === null) return; // e.g. NaN or out of 0..1 — leave the previous value in place
  getWebContext().repos.settings.set('thresholds', parsed);
  revalidatePath('/operations');
}

export async function updateClassifier(formData: FormData) {
  const parsed = parseSetting('classification', { active: String(formData.get('active')) });
  if (parsed === null) return;
  getWebContext().repos.settings.set('classification', parsed);
  revalidatePath('/operations');
}

export async function updateFilterLists(formData: FormData) {
  const parsed = parseSetting('filtering', {
    allowlist: parseLines(formData.get('allowlist')),
    blocklist: parseLines(formData.get('blocklist')),
    celebrationPhrases: parseLines(formData.get('celebrationPhrases')),
  });
  if (parsed === null) return;
  getWebContext().repos.settings.set('filtering', parsed);
  revalidatePath('/operations');
}
