import type { DbClient } from '../db/client';
import type { Repositories } from '../db/repositories';
import type { RunRow } from '../db/repositories/runs';
import type { DigestConfig } from '../config/schema';
import type { Logger } from '../logging';

/** A stage throws this to pause the run for manual intervention (e.g. a LinkedIn checkpoint). */
export class AwaitingUserSignal extends Error {}

export interface StageContext {
  db: DbClient;
  repos: Repositories;
  run: RunRow;
  config: DigestConfig;
  logger: Logger;
}

export interface Stage {
  name: string;
  /**
   * Must be idempotent: select a batch of posts in the state this stage consumes,
   * process it, and commit the batch's writes and status transitions in one transaction
   * (see `runBatchLoop`). Re-running a stage that already finished must be a no-op.
   *
   * Async since slice 4: `collect` drives a real Playwright browser, which is inherently
   * promise-based. `runPipeline` awaits whatever a stage returns, so synchronous stages (still
   * most of them) are unaffected.
   */
  run(ctx: StageContext): void | Promise<void>;
}
