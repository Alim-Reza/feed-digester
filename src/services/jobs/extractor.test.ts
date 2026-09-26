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

  it('fixture E (spec-second.md §13): a job posting produces structured extraction, not prose', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      results: [
        {
          index: 0,
          isHiringPost: true,
          roles: [
            {
              company: 'Acme',
              role: 'Staff Backend Engineer',
              location: 'Berlin',
              remoteStatus: 'hybrid',
              seniority: 'staff',
              experience: '8+ years',
              skills: ['Go', 'Kubernetes'],
            },
          ],
        },
      ],
    });
    const extractor = createJobExtractor({ llm: fakeLlm(generateObject), skillAliases: {} });

    const [result] = await extractor.extractBatch([
      input('Acme is hiring a Staff Backend Engineer in Berlin (hybrid), 8+ years, Go/Kubernetes.'),
    ]);

    expect(result).toEqual({
      isHiringPost: true,
      roles: [
        {
          company: 'Acme',
          role: 'Staff Backend Engineer',
          location: 'Berlin',
          remoteStatus: 'hybrid',
          seniority: 'staff',
          experience: '8+ years',
          skills: ['Go', 'Kubernetes'],
        },
      ],
    });
  });

  it('fixture F (spec-second.md §13): missing job fields stay null, never invented', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      results: [
        {
          index: 0,
          isHiringPost: true,
          roles: [
            {
              company: null,
              role: 'Software Engineer',
              location: null,
              remoteStatus: null,
              seniority: null,
              experience: null,
              skills: [],
            },
          ],
        },
      ],
    });
    const extractor = createJobExtractor({ llm: fakeLlm(generateObject), skillAliases: {} });

    const [result] = await extractor.extractBatch([input('We are hiring a Software Engineer.')]);

    expect(result!.roles[0]).toEqual({
      company: null,
      role: 'Software Engineer',
      location: null,
      remoteStatus: null,
      seniority: null,
      experience: null,
      skills: [],
    });
  });

  it('release() delegates to the underlying LLM provider', async () => {
    const llm = fakeLlm(vi.fn());
    const extractor = createJobExtractor({ llm, skillAliases: {} });

    await extractor.release();

    expect(llm.release).toHaveBeenCalledTimes(1);
  });
});
