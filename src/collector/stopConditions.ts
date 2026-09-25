import type { DigestConfig } from '../config/schema';

export type StopReason = 'max_duration' | 'max_posts' | 'max_consecutive_seen';

/**
 * The three "whichever comes first" stop conditions (grill C6, `digest.config.ts`
 * `stopConditions`): a max session length, a max number of newly collected posts, or too many
 * already-seen posts in a row (a sign we've scrolled past everything new).
 */
export function checkStopCondition(
  state: { elapsedMs: number; postsCollected: number; consecutiveSeen: number },
  stopConditions: DigestConfig['stopConditions'],
): StopReason | null {
  if (state.elapsedMs >= stopConditions.maxDurationMinutes * 60_000) return 'max_duration';
  if (state.postsCollected >= stopConditions.maxPosts) return 'max_posts';
  if (state.consecutiveSeen >= stopConditions.maxConsecutiveSeenPosts)
    return 'max_consecutive_seen';
  return null;
}
