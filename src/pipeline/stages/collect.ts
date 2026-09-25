import path from 'node:path';
import type { Stage, StageContext } from '../types';
import { AwaitingUserSignal } from '../types';
import { openProfile } from '../../collector/browser';
import { createPlaywrightDriver, type CollectorDriver } from '../../collector/driver';
import { collectFeed } from '../../collector/scroller';

const FEED_URL = 'https://www.linkedin.com/feed/';

type DriverSession = { driver: CollectorDriver; close: () => Promise<void> };

async function openLiveDriver(profileName: string): Promise<DriverSession> {
  const context = await openProfile(profileName);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(FEED_URL);
  return { driver: createPlaywrightDriver(page), close: () => context.close() };
}

/**
 * Runs one collection session. Takes `openSession` as a parameter (defaulting to a real,
 * headed Chrome session) so the stage's wiring — opening the configured profile, translating
 * a stalled checkpoint into `AwaitingUserSignal`, always closing the browser — is unit
 * testable against a fake driver without launching Chrome; see `collect.test.ts`. The
 * collection loop itself lives in `src/collector/scroller.ts`.
 */
export async function runCollectStage(
  ctx: StageContext,
  openSession: (profileName: string) => Promise<DriverSession> = openLiveDriver,
  now?: () => Date,
): Promise<void> {
  const { repos, config, logger, run } = ctx;
  const profileName = config.profiles.active;
  logger.info({ runId: run.id, profile: profileName }, 'collect: opening browser');

  const session = await openSession(profileName);
  try {
    const result = await collectFeed(session.driver, {
      postsRepo: repos.posts,
      postImagesRepo: repos.postImages,
      runEvents: repos.runEvents,
      runId: run.id,
      config,
      logger,
      imagesDir: path.join(config.dataDir, 'images'),
      snapshotsDir: path.join(config.dataDir, 'snapshots'),
      now,
    });
    logger.info(
      { runId: run.id, outcome: result.outcome, ...result.stats },
      'collect: session ended',
    );

    if (result.outcome === 'checkpoint_timeout') {
      repos.runEvents.log(
        run.id,
        'warn',
        'checkpoint/login wall not resolved within the wait window — pausing the run',
        { stage: 'collect', data: result.stats },
      );
      // Whatever was collected before the checkpoint is already committed (insertOrTouch runs
      // per post, not batched), so a later "process" command still processes it even though
      // this run pauses here — grill B3/Q8 ("save what it has ... continue processing it").
      throw new AwaitingUserSignal('checkpoint not resolved in time');
    }

    repos.runEvents.log(run.id, 'info', `collection stopped: ${result.reason}`, {
      stage: 'collect',
      data: result.stats,
    });
  } finally {
    await session.close();
  }
}

export const collect: Stage = {
  name: 'collect',
  run: (ctx) => runCollectStage(ctx),
};
