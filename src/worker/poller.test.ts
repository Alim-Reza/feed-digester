import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../db/testHelpers';
import { createRepositories } from '../db/repositories';
import { loadConfig } from '../config';
import { pollCommands } from './poller';
import type { Stage } from '../pipeline/types';

const logger = pino({ level: 'silent' });

function makeDeps() {
  const db = createTestDb();
  const repos = createRepositories(db);
  const config = loadConfig();
  return { db, repos, config, logger };
}

// `collect` (slice 4) drives a real browser, which these dispatch-logic tests never do (grill
// J9). Every test that reaches a pipeline run injects this no-op in its place via `opts`.
const fakeCollect: Stage = { name: 'collect', run: () => {} };

describe('pollCommands', () => {
  it('is a no-op when there is no pending command', async () => {
    const deps = makeDeps();
    await expect(pollCommands(deps)).resolves.not.toThrow();
  });

  it('claims a "collect" command and runs just the collect stage', async () => {
    const deps = makeDeps();
    deps.repos.runCommands.enqueue('collect');

    await pollCommands(deps, { stagesForCommand: () => [fakeCollect] });

    const runs = deps.repos.runs.listRecent();
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('succeeded');
    expect(runs[0].currentStage).toBe('collect');
  });

  it('completes a "login" command without starting a run', async () => {
    const deps = makeDeps();
    deps.repos.runCommands.enqueue('login');
    const loginFlow = vi.fn().mockResolvedValue(undefined);

    await pollCommands(deps, { loginFlow });

    expect(loginFlow).toHaveBeenCalledOnce();
    expect(deps.repos.runs.listRecent()).toHaveLength(0);
    // claimNext would return undefined again once completed — proves it didn't stay pending/claimed.
    expect(deps.repos.runCommands.claimNext()).toBeUndefined();
  });

  it('fails the command if the login flow throws', async () => {
    const deps = makeDeps();
    deps.repos.runCommands.enqueue('login');
    const loginFlow = vi.fn().mockRejectedValue(new Error('profile locked'));

    await pollCommands(deps, { loginFlow });

    expect(deps.repos.runCommands.claimNext()).toBeUndefined(); // not pending anymore
  });

  it('does not claim a command while a run is already active', async () => {
    const deps = makeDeps();
    deps.repos.runs.create('manual'); // status: queued, counts as active
    deps.repos.runCommands.enqueue('full');

    await pollCommands(deps, { stagesForCommand: () => [fakeCollect] });

    // The command should still be pending, i.e. claimable.
    const claimed = deps.repos.runCommands.claimNext();
    expect(claimed?.type).toBe('full');
  });

  it('processes one command per call', async () => {
    const deps = makeDeps();
    deps.repos.runCommands.enqueue('collect');
    deps.repos.runCommands.enqueue('collect');

    await pollCommands(deps, { stagesForCommand: () => [fakeCollect] });
    expect(deps.repos.runs.listRecent()).toHaveLength(1);

    await pollCommands(deps, { stagesForCommand: () => [fakeCollect] });
    expect(deps.repos.runs.listRecent()).toHaveLength(2);
  });
});
