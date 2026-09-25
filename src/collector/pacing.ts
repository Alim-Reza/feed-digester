import type { DigestConfig } from '../config/schema';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** A scroll step sized like a person nudging the page, not a script jumping to the bottom. */
export function nextScrollStepPx(pacing: DigestConfig['pacing']): number {
  return randomInt(pacing.scrollStepPxMin, pacing.scrollStepPxMax);
}

/**
 * Most pauses are short "still scrolling" gaps; occasionally (`readingPauseChance`) a longer
 * "actually reading this one" pause, so a session doesn't look metronomic. Grill B2/Q5: "slow
 * randomized scrolling, random pauses and dwell times" — not anti-bot bypassing, just not
 * hammering the site or advertising that a bot is scrolling.
 */
export function nextPauseMs(pacing: DigestConfig['pacing']): number {
  if (Math.random() < pacing.readingPauseChance) {
    return randomInt(pacing.readingPauseMsMin, pacing.readingPauseMsMax);
  }
  return randomInt(pacing.pauseMsMin, pacing.pauseMsMax);
}
