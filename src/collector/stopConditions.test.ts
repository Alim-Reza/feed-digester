import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { checkStopCondition } from './stopConditions';

const { stopConditions } = loadConfig();

describe('checkStopCondition', () => {
  it('returns null while under every threshold', () => {
    expect(
      checkStopCondition({ elapsedMs: 0, postsCollected: 0, consecutiveSeen: 0 }, stopConditions),
    ).toBeNull();
  });

  it('stops on max duration', () => {
    const reason = checkStopCondition(
      {
        elapsedMs: stopConditions.maxDurationMinutes * 60_000,
        postsCollected: 0,
        consecutiveSeen: 0,
      },
      stopConditions,
    );
    expect(reason).toBe('max_duration');
  });

  it('stops on max posts', () => {
    const reason = checkStopCondition(
      { elapsedMs: 0, postsCollected: stopConditions.maxPosts, consecutiveSeen: 0 },
      stopConditions,
    );
    expect(reason).toBe('max_posts');
  });

  it('stops on max consecutive already-seen posts', () => {
    const reason = checkStopCondition(
      { elapsedMs: 0, postsCollected: 0, consecutiveSeen: stopConditions.maxConsecutiveSeenPosts },
      stopConditions,
    );
    expect(reason).toBe('max_consecutive_seen');
  });

  it('checks duration first when multiple thresholds are hit at once', () => {
    const reason = checkStopCondition(
      {
        elapsedMs: stopConditions.maxDurationMinutes * 60_000,
        postsCollected: stopConditions.maxPosts,
        consecutiveSeen: stopConditions.maxConsecutiveSeenPosts,
      },
      stopConditions,
    );
    expect(reason).toBe('max_duration');
  });
});
