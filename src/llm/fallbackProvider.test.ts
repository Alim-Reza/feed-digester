import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createFallbackLLMProvider } from './fallbackProvider';
import type { LLMProvider } from './types';

const logger = pino({ level: 'silent' });
const schema = z.object({ ok: z.boolean() });

function fakeProvider(name: string): LLMProvider {
  return {
    name,
    generateText: vi.fn(),
    generateObject: vi.fn(),
    release: vi.fn().mockResolvedValue(undefined),
  };
}

describe('createFallbackLLMProvider.generateText', () => {
  it('returns the primary result without touching the fallback when it succeeds', async () => {
    const primary = fakeProvider('primary');
    const fallback = fakeProvider('fallback');
    vi.mocked(primary.generateText).mockResolvedValue('hello from primary');

    const provider = createFallbackLLMProvider({ primary, fallback, logger });
    const result = await provider.generateText({ prompt: 'hi' });

    expect(result).toBe('hello from primary');
    expect(fallback.generateText).not.toHaveBeenCalled();
  });

  it('falls back once when the primary is unreachable', async () => {
    const primary = fakeProvider('primary');
    const fallback = fakeProvider('fallback');
    vi.mocked(primary.generateText).mockRejectedValue(new Error('ECONNREFUSED'));
    vi.mocked(fallback.generateText).mockResolvedValue('hello from fallback');

    const provider = createFallbackLLMProvider({ primary, fallback, logger });
    const result = await provider.generateText({ prompt: 'hi' });

    expect(result).toBe('hello from fallback');
  });

  it('rethrows the primary error when there is no fallback configured', async () => {
    const primary = fakeProvider('primary');
    vi.mocked(primary.generateText).mockRejectedValue(new Error('ECONNREFUSED'));

    const provider = createFallbackLLMProvider({ primary, fallback: null, logger });

    await expect(provider.generateText({ prompt: 'hi' })).rejects.toThrow('ECONNREFUSED');
  });
});

describe('createFallbackLLMProvider.generateObject', () => {
  it('returns the primary result on the first attempt without retrying', async () => {
    const primary = fakeProvider('primary');
    const fallback = fakeProvider('fallback');
    vi.mocked(primary.generateObject).mockResolvedValue({ ok: true });

    const provider = createFallbackLLMProvider({ primary, fallback, logger });
    const result = await provider.generateObject({ schema, prompt: 'hi' });

    expect(result).toEqual({ ok: true });
    expect(primary.generateObject).toHaveBeenCalledOnce();
    expect(fallback.generateObject).not.toHaveBeenCalled();
  });

  it('retries the primary once before succeeding (within the default 2-attempt budget)', async () => {
    const primary = fakeProvider('primary');
    const fallback = fakeProvider('fallback');
    vi.mocked(primary.generateObject)
      .mockRejectedValueOnce(new Error('invalid JSON'))
      .mockResolvedValueOnce({ ok: true });

    const provider = createFallbackLLMProvider({ primary, fallback, logger });
    const result = await provider.generateObject({ schema, prompt: 'hi' });

    expect(result).toEqual({ ok: true });
    expect(primary.generateObject).toHaveBeenCalledTimes(2);
    expect(fallback.generateObject).not.toHaveBeenCalled();
  });

  it('falls back after the primary fails schema validation twice (grill F4)', async () => {
    const primary = fakeProvider('primary');
    const fallback = fakeProvider('fallback');
    vi.mocked(primary.generateObject).mockRejectedValue(new Error('invalid JSON'));
    vi.mocked(fallback.generateObject).mockResolvedValue({ ok: true });

    const provider = createFallbackLLMProvider({ primary, fallback, logger });
    const result = await provider.generateObject({ schema, prompt: 'hi' });

    expect(result).toEqual({ ok: true });
    expect(primary.generateObject).toHaveBeenCalledTimes(2);
    expect(fallback.generateObject).toHaveBeenCalledOnce();
  });

  it('throws the last error after exhausting retries with no fallback configured', async () => {
    const primary = fakeProvider('primary');
    vi.mocked(primary.generateObject).mockRejectedValue(new Error('invalid JSON'));

    const provider = createFallbackLLMProvider({ primary, fallback: null, logger });

    await expect(provider.generateObject({ schema, prompt: 'hi' })).rejects.toThrow('invalid JSON');
    expect(primary.generateObject).toHaveBeenCalledTimes(2);
  });

  it('respects a custom maxSchemaRetries', async () => {
    const primary = fakeProvider('primary');
    const fallback = fakeProvider('fallback');
    vi.mocked(primary.generateObject).mockRejectedValue(new Error('invalid JSON'));
    vi.mocked(fallback.generateObject).mockResolvedValue({ ok: true });

    const provider = createFallbackLLMProvider({ primary, fallback, logger, maxSchemaRetries: 1 });
    await provider.generateObject({ schema, prompt: 'hi' });

    expect(primary.generateObject).toHaveBeenCalledTimes(1);
    expect(fallback.generateObject).toHaveBeenCalledOnce();
  });
});

describe('createFallbackLLMProvider.release', () => {
  it('releases the primary always, and the fallback only when configured', async () => {
    const primary = fakeProvider('primary');
    const fallback = fakeProvider('fallback');

    await createFallbackLLMProvider({ primary, fallback, logger }).release();
    expect(primary.release).toHaveBeenCalledOnce();
    expect(fallback.release).toHaveBeenCalledOnce();

    const primaryOnly = fakeProvider('primary');
    await createFallbackLLMProvider({ primary: primaryOnly, fallback: null, logger }).release();
    expect(primaryOnly.release).toHaveBeenCalledOnce();
  });
});
