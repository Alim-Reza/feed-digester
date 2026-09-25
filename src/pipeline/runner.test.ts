import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '../db/testHelpers';
import { createRepositories, type Repositories } from '../db/repositories';
import { loadConfig } from '../config';
import { runPipeline } from './runner';
import { runBatchLoop } from './batch';
import type { Stage } from './types';

const logger = pino({ level: 'silent' });

function seedOcrDonePosts(repos: Repositories, runId: string, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const { post } = repos.posts.insertOrTouch({
      hash: `hash-${i}`,
      authorName: 'Author',
      firstSeenRunId: runId,
      collectedAt: new Date(),
    });
    repos.posts.updateStatus(post.id, 'ocr_done');
    ids.push(post.id);
  }
  return ids;
}

function makeFilterStage(processedIds: string[]): Stage {
  return {
    name: 'filter',
    run(ctx) {
      runBatchLoop(ctx.db, {
        batchSize: 2,
        selectBatch: (limit) => ctx.repos.posts.listByStatus('ocr_done', limit).map((p) => p.id),
        processBatch: (ids) => {
          for (const id of ids) {
            ctx.repos.posts.updateStatus(id, 'filtered');
            processedIds.push(id);
          }
        },
      });
    },
  };
}

describe('runPipeline', () => {
  it('runs a stub stage over all posts and succeeds', async () => {
    const db = createTestDb();
    const repos = createRepositories(db);
    const config = loadConfig();
    const run = repos.runs.create('manual');
    seedOcrDonePosts(repos, run.id, 5);

    const outcome = await runPipeline({ db, repos, config, logger }, run.id, [makeFilterStage([])]);

    expect(outcome).toBe('succeeded');
    expect(repos.posts.countByStatus('filtered')).toBe(5);
    expect(repos.runs.get(run.id)!.status).toBe('succeeded');
  });

  it('resumes after a crash mid-stage without reprocessing already-committed posts', async () => {
    const db = createTestDb();
    const repos = createRepositories(db);
    const config = loadConfig();
    const run = repos.runs.create('manual');
    const ids = seedOcrDonePosts(repos, run.id, 5);

    // Simulate the worker having started the run and committed exactly one batch (2 posts)
    // of the `filter` stage before the process died — never called runs.finish().
    repos.runs.start(run.id);
    repos.runs.setStage(run.id, 'filter');
    const firstBatch = repos.posts.listByStatus('ocr_done', 2).map((p) => p.id);
    db.transaction(() => {
      for (const id of firstBatch) repos.posts.updateStatus(id, 'filtered');
    });
    expect(repos.posts.countByStatus('filtered')).toBe(2);
    expect(repos.posts.countByStatus('ocr_done')).toBe(3);

    // Worker restart: stale `running` runs become `interrupted`.
    const interrupted = repos.runs.interruptRunningOnStartup();
    expect(interrupted).toHaveLength(1);
    expect(interrupted[0].id).toBe(run.id);

    // Resume: only the remaining 3 posts should be touched this time.
    const processedOnResume: string[] = [];
    const outcome = await runPipeline({ db, repos, config, logger }, run.id, [
      makeFilterStage(processedOnResume),
    ]);

    expect(outcome).toBe('succeeded');
    expect(repos.posts.countByStatus('filtered')).toBe(5);
    expect(repos.posts.countByStatus('ocr_done')).toBe(0);
    expect(processedOnResume.sort()).toEqual(ids.filter((id) => !firstBatch.includes(id)).sort());
    expect(repos.runs.get(run.id)!.status).toBe('succeeded');
    // Original startedAt is preserved across the crash/resume, not reset.
    const finalRun = repos.runs.get(run.id)!;
    expect(finalRun.startedAt).toBeInstanceOf(Date);
  });

  it('stops and marks the run awaiting_user when a stage signals a checkpoint', async () => {
    const { AwaitingUserSignal } = await import('./types');
    const db = createTestDb();
    const repos = createRepositories(db);
    const config = loadConfig();
    const run = repos.runs.create('manual');

    const checkpointStage: Stage = {
      name: 'collect',
      run() {
        throw new AwaitingUserSignal('checkpoint hit');
      },
    };

    const outcome = await runPipeline({ db, repos, config, logger }, run.id, [checkpointStage]);
    expect(outcome).toBe('awaiting_user');
    const current = repos.runs.get(run.id)!;
    expect(current.status).toBe('awaiting_user');
    expect(current.finishedAt).toBeNull();
  });

  it('marks the run failed when a stage throws a regular error', async () => {
    const db = createTestDb();
    const repos = createRepositories(db);
    const config = loadConfig();
    const run = repos.runs.create('manual');

    const brokenStage: Stage = {
      name: 'filter',
      run() {
        throw new Error('boom');
      },
    };

    const outcome = await runPipeline({ db, repos, config, logger }, run.id, [brokenStage]);
    expect(outcome).toBe('failed');
    expect(repos.runs.get(run.id)!.status).toBe('failed');
  });
});
