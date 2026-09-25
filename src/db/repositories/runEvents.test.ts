import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testHelpers';
import { createRunEventsRepository, type RunEventsRepository } from './runEvents';
import { createRunsRepository } from './runs';

let repo: RunEventsRepository;
let runId: string;

beforeEach(() => {
  const db = createTestDb();
  repo = createRunEventsRepository(db);
  runId = createRunsRepository(db).create('manual').id;
});

describe('runEventsRepository', () => {
  it('logs events with optional stage and structured data', () => {
    repo.log(runId, 'info', 'collect started', { stage: 'collect' });
    repo.log(runId, 'error', 'ocr failed', { stage: 'ocr', data: { postId: 'p1' } });

    const events = repo.listForRun(runId);
    expect(events).toHaveLength(2);
    expect(events[1].level).toBe('error');
    expect(events[1].data).toEqual({ postId: 'p1' });
  });
});
