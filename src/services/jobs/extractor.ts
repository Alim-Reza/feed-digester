import { z } from 'zod';
import type { LLMProvider } from '../../llm/types';
import { normalizeSkills } from './skillAliases';
import type { JobExtractionInput, JobExtractionResult } from './types';

const DEFAULT_CHUNK_SIZE = 5;
const DEFAULT_MAX_VALIDATION_RETRIES = 2;

const roleSchema = z.object({
  company: z.string().nullable(),
  role: z.string(),
  location: z.string().nullable(),
  remoteStatus: z.string().nullable(),
  seniority: z.string().nullable(),
  experience: z.string().nullable(),
  skills: z.array(z.string()),
});

const schema = z.object({
  results: z.array(
    z.object({
      index: z.number().int().min(0),
      isHiringPost: z.boolean(),
      roles: z.array(roleSchema),
    }),
  ),
});

function buildPrompt(inputs: JobExtractionInput[]): string {
  const postsBlock = inputs
    .map((input, i) => {
      const lines = [
        `[${i}] Author: ${input.authorName}`,
        `Content: ${input.content}`,
        input.ocrText ? `Image text: ${input.ocrText}` : null,
      ];
      return lines.filter((line): line is string => line !== null).join('\n');
    })
    .join('\n\n');

  return [
    'For each LinkedIn post below, decide whether it is someone ANNOUNCING that they (or their company/agency) are HIRING for one or more open roles — including recruiter posts and job-board reposts that name a role and company.',
    'Posts from people looking for work themselves, or posts that only mention jobs in passing without naming an open role, are NOT hiring posts: set isHiringPost to false and return an empty roles array.',
    'For a hiring post, add one entry to "roles" per distinct open role mentioned, with company, role title, location, remote status, seniority, years of experience required, and a list of key skills/technologies — use null for anything not stated in the post.',
    '',
    postsBlock,
  ].join('\n');
}

/**
 * gemma4 batched-prompt job extractor (spec's "Job extraction where relevant" step) — only ever
 * called for posts whose classified `job` category already cleared `thresholds.job` (see
 * `extractJobs.ts`), and even then groups them into chunks of `chunkSize` per LLM call rather
 * than one call per post. Same response-validation-and-retry shape as
 * `services/classification/gemmaClassifier.ts`: every returned index is checked against the
 * posts actually sent before being trusted, with up to `maxValidationRetries` attempts.
 */
export function createJobExtractor(opts: {
  llm: LLMProvider;
  skillAliases: Record<string, string>;
  chunkSize?: number;
  maxValidationRetries?: number;
}) {
  const { llm, skillAliases } = opts;
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const maxValidationRetries = opts.maxValidationRetries ?? DEFAULT_MAX_VALIDATION_RETRIES;

  async function extractChunk(inputs: JobExtractionInput[]): Promise<JobExtractionResult[]> {
    const prompt = buildPrompt(inputs);
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxValidationRetries; attempt += 1) {
      try {
        const object = await llm.generateObject({
          schema,
          prompt,
          system:
            'You extract structured job-posting data from LinkedIn posts. Respond only with the requested structured data.',
        });
        for (const r of object.results) {
          if (r.index < 0 || r.index >= inputs.length) {
            throw new Error(`job extraction response index ${r.index} out of range`);
          }
        }
        const byIndex = new Map(object.results.map((r) => [r.index, r]));
        if (byIndex.size !== inputs.length) {
          throw new Error(
            `job extraction response had ${byIndex.size} unique indices, expected ${inputs.length}`,
          );
        }
        return inputs.map((_, i) => {
          const entry = byIndex.get(i)!;
          return {
            isHiringPost: entry.isHiringPost,
            roles: entry.roles.map((role) => ({
              ...role,
              skills: normalizeSkills(role.skills, skillAliases),
            })),
          };
        });
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error('job extraction failed validation after retries');
  }

  return {
    model: llm.name,
    async extractBatch(inputs: JobExtractionInput[]): Promise<JobExtractionResult[]> {
      const results: JobExtractionResult[] = [];
      for (let i = 0; i < inputs.length; i += chunkSize) {
        const chunk = inputs.slice(i, i + chunkSize);
        results.push(...(await extractChunk(chunk)));
      }
      return results;
    },
    release: () => llm.release(),
  };
}

export type JobExtractor = ReturnType<typeof createJobExtractor>;
