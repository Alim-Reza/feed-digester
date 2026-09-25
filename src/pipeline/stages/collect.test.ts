import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../../db/testHelpers';
import { createRepositories } from '../../db/repositories';
import { loadConfig } from '../../config';
import { AwaitingUserSignal } from '../types';
import type { StageContext } from '../types';
import { runCollectStage } from './collect';
import type { CollectorDriver } from '../../collector/driver';

const logger = pino({ level: 'silent' });

function makeCtx(): StageContext {
  const db = createTestDb();
  const repos = createRepositories(db);
  const config = loadConfig();
  const run = repos.runs.create('manual');
  return { db, repos, config, logger, run };
}

const noopDriver: CollectorDriver = {
  url: () => 'https://www.linkedin.com/feed/',
  extractPosts: async () => [],
  screenshotElement: async () => false,
  scrollBy: async () => {},
  wait: async () => {},
};

describe('runCollectStage', () => {
  it('opens the active profile and closes the session when the run stops normally', async () => {
    const ctx = makeCtx();
    ctx.config = loadConfig({ stopConditions: { maxDurationMinutes: 1 } });
    // A fake clock, advanced only when the driver is told to wait, so hitting the (short,
    // overridden) duration limit doesn't require burning real wall-clock time.
    let clockMs = 0;
    const fastDriver: CollectorDriver = {
      ...noopDriver,
      wait: async (ms) => {
        clockMs += ms;
      },
    };
    const close = vi.fn().mockResolvedValue(undefined);
    const openSession = vi.fn().mockResolvedValue({ driver: fastDriver, close });

    await runCollectStage(ctx, openSession, () => new Date(clockMs));

    expect(openSession).toHaveBeenCalledWith(ctx.config.profiles.active);
    expect(close).toHaveBeenCalledOnce();
  });

  it('throws AwaitingUserSignal when the checkpoint wait window times out, and still closes the session', async () => {
    const ctx = makeCtx();
    ctx.config = loadConfig({
      stopConditions: { checkpointWaitMinutes: 1, checkpointPollSeconds: 1 },
    });
    // A fake clock that only advances when the driver is told to wait, so the test doesn't
    // burn a real minute of wall-clock time waiting out the checkpoint window.
    let clockMs = 0;
    const blockedDriver: CollectorDriver = {
      ...noopDriver,
      url: () => 'https://www.linkedin.com/checkpoint/challenge/',
      wait: async (ms) => {
        clockMs += ms;
      },
    };
    const close = vi.fn().mockResolvedValue(undefined);
    const openSession = vi.fn().mockResolvedValue({ driver: blockedDriver, close });

    await expect(runCollectStage(ctx, openSession, () => new Date(clockMs))).rejects.toBeInstanceOf(
      AwaitingUserSignal,
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the session even if collection throws unexpectedly', async () => {
    const ctx = makeCtx();
    const close = vi.fn().mockResolvedValue(undefined);
    const brokenDriver: CollectorDriver = {
      ...noopDriver,
      extractPosts: async () => {
        throw new Error('boom');
      },
    };
    const openSession = vi.fn().mockResolvedValue({ driver: brokenDriver, close });

    await expect(runCollectStage(ctx, openSession)).rejects.toThrow('boom');
    expect(close).toHaveBeenCalledOnce();
  });
});
