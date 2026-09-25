import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../config';
import type { LLMProvider } from '../../llm/types';
import { createGemmaClassifier } from './gemmaClassifier';
import type { ClassificationInput } from './types';

const { categories } = loadConfig();
const relevanceWeights = { software_engineering: 1 };

function fakeLlm(generateObject: LLMProvider['generateObject']): LLMProvider {
  return {
    name: 'ollama:gemma4:latest',
    generateText: vi.fn(),
    generateObject,
    release: vi.fn().mockResolvedValue(undefined),
  };
}

function input(overrides: Partial<ClassificationInput> = {}): ClassificationInput {
  return {
    authorName: 'Jane Doe',
    authorHeadline: 'Staff Engineer',
    content: 'A post about distributed systems.',
    ocrText: null,
    language: 'en',
    ...overrides,
  };
}

function scoresFor(categoryId: string | null): Record<string, number> {
  return Object.fromEntries(categories.map((c) => [c.id, c.id === categoryId ? 0.9 : 0.05]));
}

describe('createGemmaClassifier', () => {
  it('classifies a single chunk and maps results back by index', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      results: [{ index: 0, categories: scoresFor('software_engineering') }],
    });
    const classifier = createGemmaClassifier({
      llm: fakeLlm(generateObject),
      categories,
      relevanceWeights,
    });

    const [result] = await classifier.classifyBatch([input()]);

    expect(result!.primaryCategory).toBe('software_engineering');
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it("does not trust the LLM's own relevance number — computes it from category scores instead (ADR 0003)", async () => {
    const generateObject = vi.fn().mockResolvedValue({
      // A raw "relevance" field, if a non-conforming model sent one, must be ignored.
      results: [{ index: 0, categories: { software_engineering: 0.4 }, relevance: 0.99 }],
    });
    const classifier = createGemmaClassifier({
      llm: fakeLlm(generateObject),
      categories,
      relevanceWeights: { software_engineering: 1 },
    });

    const [result] = await classifier.classifyBatch([input()]);

    expect(result!.relevance).toBeCloseTo(0.4);
  });

  it('weights multiple categories per relevanceWeights, normalized by their sum', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      results: [{ index: 0, categories: { software_engineering: 1, career: 0 } }],
    });
    const classifier = createGemmaClassifier({
      llm: fakeLlm(generateObject),
      categories,
      relevanceWeights: { software_engineering: 3, career: 1 },
    });

    const [result] = await classifier.classifyBatch([input()]);

    // (1*3 + 0*1) / (3+1) = 0.75
    expect(result!.relevance).toBeCloseTo(0.75);
  });

  it('splits more inputs than chunkSize into multiple LLM calls', async () => {
    const generateObject = vi.fn().mockImplementation(async ({ prompt }: { prompt: string }) => {
      const indices = [...prompt.matchAll(/^\[(\d+)\]/gm)].map((m) => Number(m[1]));
      return {
        results: indices.map((index) => ({ index, categories: scoresFor('ai_ml') })),
      };
    });
    const classifier = createGemmaClassifier({
      llm: fakeLlm(generateObject),
      categories,
      relevanceWeights,
      chunkSize: 2,
    });

    const results = await classifier.classifyBatch([input(), input(), input()]);

    expect(results).toHaveLength(3);
    expect(generateObject).toHaveBeenCalledTimes(2);
  });

  it('retries once on a response with a duplicated index, then succeeds', async () => {
    const generateObject = vi
      .fn()
      .mockResolvedValueOnce({
        results: [
          { index: 0, categories: scoresFor('career') },
          { index: 0, categories: scoresFor('career') },
        ],
      })
      .mockResolvedValueOnce({
        results: [
          { index: 0, categories: scoresFor('career') },
          { index: 1, categories: scoresFor('job') },
        ],
      });
    const classifier = createGemmaClassifier({
      llm: fakeLlm(generateObject),
      categories,
      relevanceWeights,
      maxValidationRetries: 2,
    });

    const results = await classifier.classifyBatch([input(), input()]);

    expect(generateObject).toHaveBeenCalledTimes(2);
    expect(results[1]!.primaryCategory).toBe('job');
  });

  it('throws after exhausting retries on a persistently invalid response', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      results: [{ index: 5, categories: scoresFor('career') }],
    });
    const classifier = createGemmaClassifier({
      llm: fakeLlm(generateObject),
      categories,
      relevanceWeights,
      maxValidationRetries: 2,
    });

    await expect(classifier.classifyBatch([input()])).rejects.toThrow(/out of range/);
    expect(generateObject).toHaveBeenCalledTimes(2);
  });

  it('release() delegates to the underlying LLM provider', async () => {
    const llm = fakeLlm(vi.fn());
    const classifier = createGemmaClassifier({ llm, categories, relevanceWeights });

    await classifier.release();

    expect(llm.release).toHaveBeenCalledTimes(1);
  });
});
