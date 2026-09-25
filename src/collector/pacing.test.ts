import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config';
import { nextPauseMs, nextScrollStepPx } from './pacing';

const { pacing } = loadConfig();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('nextScrollStepPx', () => {
  it('stays within the configured min/max range', () => {
    for (let i = 0; i < 50; i += 1) {
      const px = nextScrollStepPx(pacing);
      expect(px).toBeGreaterThanOrEqual(pacing.scrollStepPxMin);
      expect(px).toBeLessThanOrEqual(pacing.scrollStepPxMax);
    }
  });
});

describe('nextPauseMs', () => {
  it('returns a normal pause when the reading-pause roll misses', () => {
    vi.spyOn(Math, 'random').mockReturnValue(pacing.readingPauseChance + 0.01);
    const ms = nextPauseMs(pacing);
    expect(ms).toBeGreaterThanOrEqual(pacing.pauseMsMin);
    expect(ms).toBeLessThanOrEqual(pacing.pauseMsMax);
  });

  it('returns a longer reading pause when the roll hits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const ms = nextPauseMs(pacing);
    expect(ms).toBeGreaterThanOrEqual(pacing.readingPauseMsMin);
    expect(ms).toBeLessThanOrEqual(pacing.readingPauseMsMax);
  });
});
