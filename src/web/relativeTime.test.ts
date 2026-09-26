import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relativeTime';

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-26T12:00:00Z');

  it('reports "just now" for sub-minute gaps', () => {
    expect(formatRelativeTime(new Date('2026-09-26T11:59:30Z'), now)).toBe('just now');
  });

  it('reports minutes for under an hour', () => {
    expect(formatRelativeTime(new Date('2026-09-26T11:52:00Z'), now)).toBe('8m ago');
  });

  it('reports hours for under a day', () => {
    expect(formatRelativeTime(new Date('2026-09-26T09:00:00Z'), now)).toBe('3h ago');
  });

  it('reports days beyond a day', () => {
    expect(formatRelativeTime(new Date('2026-09-23T12:00:00Z'), now)).toBe('3d ago');
  });
});
