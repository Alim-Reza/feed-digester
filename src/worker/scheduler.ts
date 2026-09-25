import type { DbClient } from '../db/client';
import type { Repositories } from '../db/repositories';
import type { DigestConfig } from '../config/schema';
import type { Logger } from '../logging';
import { runPipeline } from '../pipeline/runner';
import { allStages } from '../pipeline/stages';
import type { Stage } from '../pipeline/types';

function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isPastDailyAt(now: Date, dailyAt: string): boolean {
  const [hours, minutes] = dailyAt.split(':').map(Number);
  const today = new Date(now);
  today.setHours(hours, minutes, 0, 0);
  return now >= today;
}

/**
 * Checked every minute by the worker. If no scheduled run has succeeded today and it's past
 * `schedule.dailyAt` local time, starts one — this also gives catch-up after sleep. A no-op if
 * another run is already active (ADR 0002: one run at a time). Async since `runPipeline` is
 * (slice 4: `collect` drives a real browser).
 *
 * Also a no-op once `stopConditions.maxRunsPerDay` scheduled runs have *started* today,
 * regardless of outcome — grill B2/Q5's "caps on session length and runs per day" was meant to
 * stop exactly this: without it, a scheduled run that fails fast (e.g. a locked browser
 * profile) had no cooldown at all, so the very next minute's check just started another one,
 * indefinitely, every minute, all day. A real repro: a stale Chrome `SingletonLock` made
 * `collect` fail in ~1s, and the scheduler fired 10+ times in under an hour before this fix.
 *
 * `stages` defaults to the real `allStages` (including live collection) but can be overridden
 * in tests, so exercising the scheduling logic here never launches a real browser.
 */
export async function checkSchedule(
  deps: { db: DbClient; repos: Repositories; config: DigestConfig; logger: Logger },
  now: Date = new Date(),
  stages: Stage[] = allStages,
): Promise<void> {
  const { repos, config, logger } = deps;
  if (!config.schedule.enabled) return;
  if (!isPastDailyAt(now, config.schedule.dailyAt)) return;
  if (repos.runs.succeededSince('scheduled', startOfLocalDay(now))) return;
  if (repos.runs.hasActiveRun()) return;

  const attemptsToday = repos.runs.countStartedSince('scheduled', startOfLocalDay(now));
  if (attemptsToday >= config.stopConditions.maxRunsPerDay) {
    logger.warn(
      { attemptsToday, maxRunsPerDay: config.stopConditions.maxRunsPerDay },
      'scheduler: reached maxRunsPerDay for scheduled runs, waiting until tomorrow',
    );
    return;
  }

  const run = repos.runs.create('scheduled');
  logger.info({ runId: run.id, attemptsToday: attemptsToday + 1 }, 'scheduler starting daily run');
  await runPipeline(deps, run.id, stages);
}
