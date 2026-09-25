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

describe('createSummarizer.summarizeCluster', () => {
  it('returns a valid summary on the first attempt', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      title: 'Distributed systems',
      bullets: [{ text: 'Teams are scaling queues [1][2].', sources: [1, 2] }],
    });
    const summarizer = createSummarizer({ llm: fakeLlm(generateObject) });

    const result = await summarizer.summarizeCluster('Software Engineering', posts(2));

    expect(result.title).toBe('Distributed systems');
    expect(generateObject).toHaveBeenCalledTimes(1);
  });

  it('retries once when a bullet cites a source number that was not given, then succeeds', async () => {
    const generateObject = vi
      .fn()
      .mockResolvedValueOnce({
        title: 'Bad',
        bullets: [{ text: 'Invented source [5].', sources: [5] }],
      })
      .mockResolvedValueOnce({
        title: 'Good',
        bullets: [{ text: 'Real source [1].', sources: [1] }],
      });
    const summarizer = createSummarizer({ llm: fakeLlm(generateObject), maxRetries: 2 });

    const result = await summarizer.summarizeCluster('Career', posts(1));

    expect(result.title).toBe('Good');
    expect(generateObject).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries on a persistently invalid citation', async () => {
    const generateObject = vi.fn().mockResolvedValue({
      title: 'Bad',
      bullets: [{ text: 'Invented source [9].', sources: [9] }],
    });
    const summarizer = createSummarizer({ llm: fakeLlm(generateObject), maxRetries: 2 });

    await expect(summarizer.summarizeCluster('Career', posts(1))).rejects.toThrow(
      /cites source \[9\]/,
    );
    expect(generateObject).toHaveBeenCalledTimes(2);
  });
});

describe('createSummarizer.summarizeSection', () => {
  it('returns the tldr text', async () => {
    const generateObject = vi.fn().mockResolvedValue({ tldr: 'A short summary.' });
    const summarizer = createSummarizer({ llm: fakeLlm(generateObject) });

    const tldr = await summarizer.summarizeSection('AI / ML', ['Topic A', 'Topic B']);

    expect(tldr).toBe('A short summary.');
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
