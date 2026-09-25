import { z } from 'zod';
import type { CategoryConfig } from '../../config/schema';
import type { LLMProvider } from '../../llm/types';
import { pickPrimaryCategory } from './shared';
import { computeWeightedRelevance } from './relevance';
import type { Classifier, ClassificationInput, ClassificationResult } from './types';

const DEFAULT_CHUNK_SIZE = 5;
const DEFAULT_MAX_VALIDATION_RETRIES = 2;

function buildSchema(categoryIds: string[]) {
  const categoryScoresSchema = z.object(
    Object.fromEntries(categoryIds.map((id) => [id, z.number().min(0).max(1)])),
  );
  return z.object({
    results: z.array(
      z.object({
        index: z.number().int().min(0),
        categories: categoryScoresSchema,
      }),
    ),
  });
}

function buildPrompt(inputs: ClassificationInput[], categories: readonly CategoryConfig[]): string {
  const categoryList = categories
    .map((c) => `- ${c.id}: ${c.label} — ${c.description}`)
    .join('\n');
  const postsBlock = inputs
    .map((input, i) => {
      const lines = [
        `[${i}] Author: ${input.authorName}`,
        input.authorHeadline ? `Headline: ${input.authorHeadline}` : null,
        `Content: ${input.content}`,
        input.ocrText ? `Image text: ${input.ocrText}` : null,
      ];
      return lines.filter((line): line is string => line !== null).join('\n');
    })
    .join('\n\n');

  const lines = [
    'You are classifying LinkedIn posts. For each post, score every one of these categories from 0 to 1 (confidence the post belongs to that category — posts can belong to several, or none):',
    categoryList,
    '',
    'Score every category for every post, even if the score is 0. Return exactly one result per post below, with "index" matching the number in brackets.',
    '',
    postsBlock,
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
}

/**
 * gemma4 batched-prompt `Classifier`: groups posts into chunks of `chunkSize` and asks the LLM to
 * score every post against every category in one prompt, instead of one Ollama round-trip per
 * post — spec's "batch classification" optimization ("I care more about minimizing unnecessary
 * inference than about real-time speed").
 *
 * Every response is validated against the posts actually sent — right count, indices 0..n-1,
 * no duplicates or gaps — before being trusted (CLAUDE.md's "citations are validated, never
 * trusted" rule, applied here so a malformed response can't silently misattribute one post's
 * scores to another). A chunk that keeps failing validation after `maxValidationRetries` throws,
 * so the `classify` stage can record a per-post attempt failure instead of committing garbage.
 *
 * Deliberately doesn't ask the LLM for its own "relevance" number (ADR 0003's bake-off found
 * gemma4's own relevance badly calibrated — far too generous). Relevance is instead computed
 * from its category scores via `computeWeightedRelevance`, weighted by `relevanceWeights`.
 */
export function createGemmaClassifier(opts: {
  llm: LLMProvider;
  categories: readonly CategoryConfig[];
  relevanceWeights: Record<string, number>;
  chunkSize?: number;
  maxValidationRetries?: number;
}): Classifier {
  const { llm, categories, relevanceWeights } = opts;
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const maxValidationRetries = opts.maxValidationRetries ?? DEFAULT_MAX_VALIDATION_RETRIES;
  const categoryIds = categories.map((c) => c.id);
  const schema = buildSchema(categoryIds);

  async function classifyChunk(inputs: ClassificationInput[]): Promise<ClassificationResult[]> {
    const prompt = buildPrompt(inputs, categories);
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxValidationRetries; attempt += 1) {
      try {
        const object = await llm.generateObject({
          schema,
          prompt,
          system:
            'You are a precise content classifier. Respond only with the requested structured data.',
        });
        for (const r of object.results) {
          if (r.index < 0 || r.index >= inputs.length) {
            throw new Error(`classification response index ${r.index} out of range`);
          }
        }
        const byIndex = new Map(object.results.map((r) => [r.index, r]));
        if (byIndex.size !== inputs.length) {
          throw new Error(
            `classification response had ${byIndex.size} unique indices, expected ${inputs.length}`,
          );
        }
        return inputs.map((_, i) => {
          const entry = byIndex.get(i)!;
          return {
            categories: entry.categories,
            primaryCategory: pickPrimaryCategory(entry.categories, categories),
            relevance: computeWeightedRelevance(entry.categories, relevanceWeights),
          };
        });
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error('classification failed validation after retries');
  }

  return {
    name: 'gemma4',
    model: llm.name,

    async classifyBatch(inputs) {
      const results: ClassificationResult[] = [];
      for (let i = 0; i < inputs.length; i += chunkSize) {
        const chunk = inputs.slice(i, i + chunkSize);
        results.push(...(await classifyChunk(chunk)));
      }
      return results;
    },

    release: () => llm.release(),
  };
}
