import type { DbClient } from '../db/client';
import type { Repositories } from '../db/repositories';
import type { DigestConfig } from '../config/schema';
import type { Logger } from '../logging';
import { AwaitingUserSignal, type Stage } from './types';

export type RunOutcome = 'succeeded' | 'failed' | 'awaiting_user';

/**
 * Runs `stages` in order against `runId`, starting from the run's `currentStage` (so an
 * `interrupted` run resumes where it left off — see ADR 0002). Each stage is expected to be
 * idempotent on its own, so re-entering a stage that already finished is safe. Async because
 * `collect` (slice 4) drives a real browser; `await`ing a synchronous stage's `void` return is
 * a no-op, so this doesn't change behavior for the other stages.
 */
export async function runPipeline(
  deps: { db: DbClient; repos: Repositories; config: DigestConfig; logger: Logger },
  runId: string,
  stages: Stage[],
  now: Date = new Date(),
): Promise<RunOutcome> {
  const { db, repos, config, logger } = deps;
  const run = repos.runs.get(runId);
  if (!run) throw new Error(`run ${runId} not found`);

  if (run.status === 'interrupted') repos.runs.resume(runId);
  else repos.runs.start(runId, now);

  const startIndex = run.currentStage ? stages.findIndex((s) => s.name === run.currentStage) : 0;

  for (let i = Math.max(startIndex, 0); i < stages.length; i += 1) {
    const stage = stages[i];
    repos.runs.setStage(runId, stage.name);
    const current = repos.runs.get(runId)!;
    logger.info({ runId, stage: stage.name }, 'stage started');
    repos.runEvents.log(runId, 'info', 'stage started', { stage: stage.name });
    try {
      await stage.run({ db, repos, run: current, config, logger });
    } catch (err) {
      if (err instanceof AwaitingUserSignal) {
        logger.warn({ runId, stage: stage.name }, 'run paused awaiting user');
        repos.runEvents.log(runId, 'warn', 'run paused awaiting user', { stage: stage.name });
        repos.runs.finish(runId, 'awaiting_user');
        return 'awaiting_user';
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ runId, stage: stage.name, err }, 'stage failed');
      repos.runEvents.log(runId, 'error', `stage failed: ${message}`, { stage: stage.name });
      repos.runs.finish(runId, 'failed', { error: message });
      return 'failed';
    }
    logger.info({ runId, stage: stage.name }, 'stage finished');
    repos.runEvents.log(runId, 'info', 'stage finished', { stage: stage.name });
  }

  repos.runs.finish(runId, 'succeeded');
  repos.runEvents.log(runId, 'info', 'run succeeded');
  return 'succeeded';
}
