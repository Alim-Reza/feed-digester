import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testHelpers';
import { createRunsRepository, type RunsRepository } from './runs';

let repo: RunsRepository;

beforeEach(() => {
  repo = createRunsRepository(createTestDb());
});

describe('runsRepository', () => {
  it('creates a queued run', () => {
    const run = repo.create('scheduled');
    expect(run.status).toBe('queued');
    expect(run.trigger).toBe('scheduled');
  });

  it('starts and advances stages', () => {
    const run = repo.create('manual');
    repo.start(run.id);
    repo.setStage(run.id, 'collect');
    const current = repo.get(run.id)!;
    expect(current.status).toBe('running');
    expect(current.startedAt).toBeInstanceOf(Date);
    expect(current.currentStage).toBe('collect');
  });

  it('finishes a run and stores stats', () => {
    const run = repo.create('manual');
    repo.start(run.id);
    repo.finish(run.id, 'succeeded', { collected: 42 });
    const current = repo.get(run.id)!;
    expect(current.status).toBe('succeeded');
    expect(current.finishedAt).toBeInstanceOf(Date);
    expect(current.stats).toEqual({ collected: 42 });
  });

  it('does not set finishedAt when awaiting_user', () => {
    const run = repo.create('manual');
    repo.start(run.id);
    repo.finish(run.id, 'awaiting_user');
    expect(repo.get(run.id)!.finishedAt).toBeNull();
  });

  it('interrupts stale running runs on startup', () => {
    const run = repo.create('scheduled');
    repo.start(run.id);
    const interrupted = repo.interruptRunningOnStartup();
    expect(interrupted).toHaveLength(1);
    expect(repo.get(run.id)!.status).toBe('interrupted');
  });

  it('lists recent runs newest first', () => {
    const first = repo.create('manual');
    const second = repo.create('scheduled');
    const recent = repo.listRecent();
    expect(recent.map((r) => r.id)).toEqual([second.id, first.id]);
  });

  it('countStartedSince counts started runs of that trigger since the given time, any outcome', () => {
    const before = new Date('2026-09-25T00:00:00Z');
    const scheduled1 = repo.create('scheduled');
    repo.start(scheduled1.id);
    repo.finish(scheduled1.id, 'failed');
    const scheduled2 = repo.create('scheduled');
    repo.start(scheduled2.id);
    const manual = repo.create('manual');
    repo.start(manual.id);

    expect(repo.countStartedSince('scheduled', before)).toBe(2);
    expect(repo.countStartedSince('manual', before)).toBe(1);
  });

  it('countStartedSince does not count a run that was created but never started', () => {
    const before = new Date('2026-09-25T00:00:00Z');
    repo.create('scheduled');
    expect(repo.countStartedSince('scheduled', before)).toBe(0);
  });
});
