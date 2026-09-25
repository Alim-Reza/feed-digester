import { loadConfig } from '../config';
import { loadSettingsOverrides } from '../config/settingsOverrides';
import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { createRepositories } from '../db/repositories';
import { createLogger } from '../logging';
import { runPipeline } from '../pipeline/runner';
import { allStages } from '../pipeline/stages';
import { pollCommands } from './poller';
import { checkSchedule } from './scheduler';

const POLL_INTERVAL_MS = 2000;
const SCHEDULE_CHECK_INTERVAL_MS = 60_000;

async function main(): Promise<void> {
  // Two-phase load: the file defaults get us `dataDir` to open the DB (and a logger — created
  // from the file default even if a settings row overrides `dataDir`, since a warning about a
  // bad override needs somewhere to go before the override it might be about is applied), then
  // `settings` table overrides (edited through the UI — grill I1/J13) are layered on top for
  // the real config this process runs with. Read once at startup — a setting changed mid-run
  // takes effect on the next worker restart, not immediately.
  const baseConfig = loadConfig();
  const db = createDb(baseConfig.dataDir);
  runMigrations(db);
  const repos = createRepositories(db);
  const logger = createLogger(baseConfig, 'worker');
  const config = loadConfig(
    loadSettingsOverrides(repos, (key, issues) =>
      logger.warn({ key, issues }, 'settings: ignoring invalid override for this key'),
    ),
  );
  const deps = { db, repos, config, logger };

  logger.info({ dataDir: config.dataDir }, 'worker starting');

  // A `running` row here means the process died mid-run last time — resume it now,
  // before accepting any new commands or scheduled runs. See ADR 0002.
  for (const run of repos.runs.interruptRunningOnStartup()) {
    logger.warn(
      { runId: run.id, stage: run.currentStage },
      'resuming interrupted run from startup',
    );
    await runPipeline(deps, run.id, allStages);
  }

  // A poll or schedule check can now be mid-flight for minutes at a time (a real collection
  // session, or a checkpoint wait) — `setInterval` doesn't wait for an async callback to
  // finish, so these guards keep the next tick from starting a second one on top of it.
  let polling = false;
  const pollTimer = setInterval(() => {
    if (polling) return;
    polling = true;
    void pollCommands(deps)
      .catch((err) => logger.error({ err }, 'command poll tick failed'))
      .finally(() => {
        polling = false;
      });
  }, POLL_INTERVAL_MS);

  let scheduling = false;
  const scheduleTimer = setInterval(() => {
    if (scheduling) return;
    scheduling = true;
    void checkSchedule(deps)
      .catch((err) => logger.error({ err }, 'schedule check tick failed'))
      .finally(() => {
        scheduling = false;
      });
  }, SCHEDULE_CHECK_INTERVAL_MS);

  const shutdown = () => {
    logger.info('worker shutting down');
    clearInterval(pollTimer);
    clearInterval(scheduleTimer);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
