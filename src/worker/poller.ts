import type { DbClient } from '../db/client';
import type { Repositories } from '../db/repositories';
import type { DigestConfig } from '../config/schema';
import type { Logger } from '../logging';
import { runPipeline } from '../pipeline/runner';
import { stagesForCommand } from '../pipeline/stageSets';
import { runLoginFlow } from '../collector/loginFlow';

/**
 * Checked frequently by the worker. Claims and runs at most one `run_commands` row per tick.
 * `web` is the only process that inserts commands; `worker` is the only one that claims and
 * executes them (ADR 0002). A no-op if a run is already active. Async since slice 4: both a
 * pipeline run (real Playwright collection) and the login flow can take minutes.
 *
 * `opts` overrides `loginFlow`/`stagesForCommand` for tests, so exercising the dispatch logic
 * here never launches a real browser — collector tests use saved fixtures only (grill J9).
 */
export async function pollCommands(
  deps: { db: DbClient; repos: Repositories; config: DigestConfig; logger: Logger },
  opts: { loginFlow?: typeof runLoginFlow; stagesForCommand?: typeof stagesForCommand } = {},
): Promise<void> {
  const { repos, config, logger } = deps;
  if (repos.runs.hasActiveRun()) return;

  const command = repos.runCommands.claimNext();
  if (!command) return;

  if (command.type === 'login') {
    try {
      await (opts.loginFlow ?? runLoginFlow)(config, logger);
      repos.runCommands.complete(command.id);
    } catch (err) {
      logger.error({ commandId: command.id, err }, 'login flow failed');
      repos.runCommands.fail(command.id);
    }
    return;
  }

  const run = repos.runs.create('manual');
  logger.info(
    { commandId: command.id, runId: run.id, type: command.type },
    'worker starting run from command',
  );
  try {
    const stages = (opts.stagesForCommand ?? stagesForCommand)(command.type);
    await runPipeline(deps, run.id, stages);
    repos.runCommands.complete(command.id);
  } catch (err) {
    logger.error({ commandId: command.id, err }, 'run command failed unexpectedly');
    repos.runCommands.fail(command.id);
  }
}
