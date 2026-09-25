import { describe, expect, it, vi } from 'vitest';
import type { LLMProvider } from '../../llm/types';
import { createJobExtractor } from './extractor';
import type { JobExtractionInput } from './types';

function fakeLlm(generateObject: LLMProvider['generateObject']): LLMProvider {
  return {
    name: 'ollama:gemma4:latest',
    generateText: vi.fn(),
    generateObject,
    release: vi.fn().mockResolvedValue(undefined),
  };
}

function input(content = 'We are hiring a Senior Backend Engineer.'): JobExtractionInput {
  return { authorName: 'Recruiter', content, ocrText: null };
}

describe('createJobExtractor', () => {
  it('extracts roles and normalizes skills through the alias dictionary', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      results: [
        {
          index: 0,
          isHiringPost: true,
          roles: [
            {
              company: 'Acme',
              role: 'Backend Engineer',
              location: 'Remote',
              remoteStatus: 'remote',
              seniority: 'senior',
              experience: '5+ years',
              skills: ['k8s', 'Go'],
            },
          ],
        },
      ],
    });
    const extractor = createJobExtractor({
      llm: fakeLlm(generateObject),
      skillAliases: { k8s: 'Kubernetes' },
    });

    const [result] = await extractor.extractBatch([input()]);

    expect(result!.isHiringPost).toBe(true);
    expect(result!.roles[0]!.skills).toEqual(['Kubernetes', 'Go']);
  });

  it('returns no roles for a non-hiring post without discarding the batch', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      results: [{ index: 0, isHiringPost: false, roles: [] }],
    });
    const extractor = createJobExtractor({ llm: fakeLlm(generateObject), skillAliases: {} });

    const [result] = await extractor.extractBatch([input('Looking for my next role, open to work.')]);

    expect(result).toEqual({ isHiringPost: false, roles: [] });
  });

  it('throws after exhausting retries on an out-of-range index', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      results: [{ index: 3, isHiringPost: true, roles: [] }],
    });
    const extractor = createJobExtractor({
      llm: fakeLlm(generateObject),
      skillAliases: {},
      maxValidationRetries: 2,
    });

    await expect(extractor.extractBatch([input()])).rejects.toThrow(/out of range/);
    expect(generateObject).toHaveBeenCalledTimes(2);
  });

  it('release() delegates to the underlying LLM provider', async () => {
    const llm = fakeLlm(vi.fn());
    const extractor = createJobExtractor({ llm, skillAliases: {} });

    await extractor.release();

    expect(llm.release).toHaveBeenCalledTimes(1);
  });
});
