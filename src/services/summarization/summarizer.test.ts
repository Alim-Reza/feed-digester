import { describe, expect, it, vi } from 'vitest';
import type { LLMProvider } from '../../llm/types';
import { createSummarizer } from './summarizer';
import type { SourcePost } from './types';

function fakeLlm(generateObject: LLMProvider['generateObject']): LLMProvider {
  return {
    name: 'ollama:gemma4:latest',
    generateText: vi.fn(),
    generateObject,
    release: vi.fn().mockResolvedValue(undefined),
  };
}

function posts(n: number): SourcePost[] {
  return Array.from({ length: n }, (_, i) => ({
    authorName: `Author ${i}`,
    content: `Post content ${i}`,
    url: null,
  }));
}

const validInsight = {
  isInsight: true,
  title: 'One coordinating agent may reduce multi-agent cognitive overhead',
  summary: 'Delegating bounded work to sub-agents through one coordinator simplifies review.',
  whyItMatters: 'Relevant to agentic IDE and multi-agent workflows.',
  suggestedAction: 'Try this workflow',
  noveltyLevel: 'high' as const,
  confidence: 'medium' as const,
};

describe('createSummarizer.evaluateCluster', () => {
  it('returns a valid insight on the first attempt', async () => {
    const generateObject = vi.fn().mockResolvedValue(validInsight);
    const summarizer = createSummarizer({ llm: fakeLlm(generateObject) });

    const result = await summarizer.evaluateCluster('AI / ML', posts(3));

    expect(result).toEqual({ ...validInsight });
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it('trusts isInsight: false and does not require the other fields', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      isInsight: false,
      title: '',
      summary: '',
      whyItMatters: '',
      suggestedAction: null,
      noveltyLevel: 'low',
      confidence: 'low',
    });
    const summarizer = createSummarizer({ llm: fakeLlm(generateObject) });

    const result = await summarizer.evaluateCluster('Career', posts(1));

    expect(result).toEqual({ isInsight: false });
  });

  it('retries once when isInsight is true but the title is empty, then succeeds', async () => {
    const generateObject = vi
      .fn()
      .mockResolvedValueOnce({ ...validInsight, title: '' })
      .mockResolvedValueOnce(validInsight);
    const summarizer = createSummarizer({ llm: fakeLlm(generateObject), maxRetries: 2 });

    const result = await summarizer.evaluateCluster('AI / ML', posts(2));

    expect(result).toEqual({ ...validInsight });
    expect(generateObject).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries on a persistently empty summary', async () => {
    const generateObject = vi.fn().mockResolvedValue({ ...validInsight, summary: '   ' });
    const summarizer = createSummarizer({ llm: fakeLlm(generateObject), maxRetries: 2 });

    await expect(summarizer.evaluateCluster('Career', posts(1))).rejects.toThrow(/empty summary/);
    expect(generateObject).toHaveBeenCalledTimes(2);
  });
});

describe('createSummarizer.release', () => {
  it('delegates to the underlying LLM provider', async () => {
    const llm = fakeLlm(vi.fn());
    const summarizer = createSummarizer({ llm });

    await summarizer.release();

    expect(llm.release).toHaveBeenCalledTimes(1);
  });
});
