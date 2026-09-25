import { describe, expect, it } from 'vitest';
import { publishedAtFromRelativeText, publishedAtFromUrn } from './time';

describe('publishedAtFromUrn', () => {
  it('decodes a known activity URN via id >> 22', () => {
    const ms = 1_700_000_000_000;
    const id = (BigInt(ms) << 22n) + 999n;
    const date = publishedAtFromUrn(`urn:li:activity:${id.toString()}`);
    expect(date?.getTime()).toBe(ms);
  });

  it('returns null for a non-activity/share URN', () => {
    expect(publishedAtFromUrn('urn:li:member:123')).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(publishedAtFromUrn('not a urn')).toBeNull();
  });
});

describe('publishedAtFromRelativeText', () => {
  const now = new Date('2026-09-25T12:00:00Z');

  it('handles "Just now"', () => {
    expect(publishedAtFromRelativeText('Just now', now)?.getTime()).toBe(now.getTime());
  });

  it.each([
    ['45m', 45 * 60_000],
    ['5h', 5 * 3_600_000],
    ['4d', 4 * 86_400_000],
    ['2w', 2 * 604_800_000],
    ['5mo', 5 * 2_629_800_000],
    ['1yr', 1 * 31_557_600_000],
  ])('parses "%s"', (text, expectedMsAgo) => {
    const date = publishedAtFromRelativeText(text, now);
    expect(date?.getTime()).toBe(now.getTime() - expectedMsAgo);
  });

  it('returns null when there is no recognizable unit', () => {
    expect(publishedAtFromRelativeText('sometime', now)).toBeNull();
  });
});
