import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '../db/testHelpers';
import { createRepositories } from '../db/repositories';
import { loadConfig } from '../config';
import { checkSchedule } from './scheduler';
import type { Stage } from '../pipeline/types';

const logger = pino({ level: 'silent' });

function makeDeps(overrides: Parameters<typeof loadConfig>[0] = {}) {
  const db = createTestDb();
  const repos = createRepositories(db);
  const config = loadConfig(overrides);
  return { db, repos, config, logger };
}

const morning = new Date(2026, 8, 25, 9, 0, 0); // 09:00 local, past the default 08:00 schedule
const beforeSchedule = new Date(2026, 8, 25, 6, 0, 0); // 06:00 local, before the default 08:00

// `allStages` (the real default) starts with `collect`, which drives a real browser since
// slice 4 — never appropriate in a unit test (grill J9). Tests that let a scheduled run
// actually execute inject this no-op stage set instead.
const fakeStages: Stage[] = [{ name: 'collect', run: () => {} }];

describe('checkSchedule', () => {
  it('does nothing when disabled', async () => {
    const deps = makeDeps({ schedule: { enabled: false, dailyAt: '08:00', timezone: 'local' } });
    await checkSchedule(deps, morning);
    expect(deps.repos.runs.listRecent()).toHaveLength(0);
  });

  it('does nothing before the scheduled time', async () => {
    const deps = makeDeps();
    await checkSchedule(deps, beforeSchedule);
    expect(deps.repos.runs.listRecent()).toHaveLength(0);
  });

  it('starts a scheduled run once past the scheduled time', async () => {
    const deps = makeDeps();
    await checkSchedule(deps, morning, fakeStages);
    const runs = deps.repos.runs.listRecent();
    expect(runs).toHaveLength(1);
    expect(runs[0].trigger).toBe('scheduled');
    expect(runs[0].status).toBe('succeeded');
  });

  it('does not start a second run the same day once one has succeeded', async () => {
    const deps = makeDeps();
    await checkSchedule(deps, morning, fakeStages);
    await checkSchedule(deps, new Date(morning.getTime() + 60_000), fakeStages);
    expect(deps.repos.runs.listRecent()).toHaveLength(1);
  });

  it('does not start a run while one is already active', async () => {
    const deps = makeDeps();
    deps.repos.runs.create('manual');
    await checkSchedule(deps, morning, fakeStages);
    // Only the pre-existing active run should exist — no scheduled run was started.
    expect(deps.repos.runs.listRecent()).toHaveLength(1);
    expect(deps.repos.runs.listRecent()[0].trigger).toBe('manual');
  });

  it('gives catch-up after being off overnight: still runs the next time it is checked', async () => {
    const deps = makeDeps();
    // Worker wasn't running at 08:00; first check happens later in the day.
    const lateCheck = new Date(2026, 8, 25, 14, 30, 0);
    await checkSchedule(deps, lateCheck, fakeStages);
    expect(deps.repos.runs.listRecent()).toHaveLength(1);
  });

  it('retries a failed scheduled run on the next check, up to maxRunsPerDay', async () => {
    const deps = makeDeps({ stopConditions: { maxRunsPerDay: 2 } });
    const failingStages: Stage[] = [
      {
        name: 'collect',
        run: () => {
          throw new Error('profile locked');
        },
      },
    ];

    await checkSchedule(deps, morning, failingStages);
    await checkSchedule(deps, new Date(morning.getTime() + 60_000), failingStages);

    const runs = deps.repos.runs.listRecent();
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.status === 'failed')).toBe(true);
  });

  it('stops retrying once maxRunsPerDay attempts have started today, even if all failed', async () => {
    const deps = makeDeps({ stopConditions: { maxRunsPerDay: 2 } });
    const failingStages: Stage[] = [
      {
        name: 'collect',
        run: () => {
          throw new Error('profile locked');
        },
      },
    ];

    // Three checks, one minute apart — only the first two should actually start a run.
    await checkSchedule(deps, morning, failingStages);
    await checkSchedule(deps, new Date(morning.getTime() + 60_000), failingStages);
    await checkSchedule(deps, new Date(morning.getTime() + 120_000), failingStages);

    expect(deps.repos.runs.listRecent()).toHaveLength(2);
  });

  it('resumes retrying the next day once the cap resets', async () => {
    const deps = makeDeps({ stopConditions: { maxRunsPerDay: 1 } });
    const failingStages: Stage[] = [
      {
        name: 'collect',
        run: () => {
          throw new Error('profile locked');
        },
      },
    ];

    await checkSchedule(deps, morning, failingStages);
    await checkSchedule(deps, new Date(morning.getTime() + 60_000), failingStages);
    expect(deps.repos.runs.listRecent()).toHaveLength(1);

    const nextMorning = new Date(2026, 8, 26, 9, 0, 0);
    await checkSchedule(deps, nextMorning, failingStages);
    expect(deps.repos.runs.listRecent()).toHaveLength(2);
  });
});
