import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testHelpers';
import { createRunCommandsRepository, type RunCommandsRepository } from './runCommands';

let repo: RunCommandsRepository;

beforeEach(() => {
  repo = createRunCommandsRepository(createTestDb());
});

describe('runCommandsRepository', () => {
  it('claims the oldest pending command and hides it from future claims', () => {
    repo.enqueue('collect');
    const second = repo.enqueue('process');

    const claimed = repo.claimNext();
    expect(claimed?.type).toBe('collect');
    expect(claimed?.status).toBe('claimed');

    const nextClaim = repo.claimNext();
    expect(nextClaim?.id).toBe(second.id);

    expect(repo.claimNext()).toBeUndefined();
  });

  it('completes and fails commands', () => {
    const cmd = repo.enqueue('login');
    repo.claimNext();
    repo.complete(cmd.id);
    expect(repo.claimNext()).toBeUndefined();
  });

  it('returns undefined when nothing is pending', () => {
    expect(repo.claimNext()).toBeUndefined();
  });
});
