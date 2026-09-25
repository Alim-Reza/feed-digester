import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../db/testHelpers';
import { createRepositories, type Repositories } from '../../db/repositories';
import { runs as runsTable } from '../../db/schema';
import { loadConfig } from '../../config';
import { retention, retentionCutoff, isSnapshotExpired } from './retention';
import type { StageContext } from '../types';

const logger = pino({ level: 'silent' });

let tmpDir: string;
let repos: Repositories;
let ctx: StageContext;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-retention-'));
  const db = createTestDb();
  repos = createRepositories(db);
  const config = loadConfig({ retention: { keepCompletedRuns: 2 }, dataDir: tmpDir });
  const run = repos.runs.create('manual');
  ctx = { db, repos, config, logger, run };
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function succeedRunAt(finishedAt: Date) {
  const run = repos.runs.create('manual');
  repos.runs.start(run.id);
  repos.runs.finish(run.id, 'succeeded');
  // `finish` stamps `finishedAt: new Date()` — backdate it directly for deterministic tests.
  ctx.db.update(runsTable).set({ finishedAt }).where(eq(runsTable.id, run.id)).run();
}

describe('retentionCutoff', () => {
  it('is null until keepCompletedRuns runs have succeeded', () => {
    expect(retentionCutoff(ctx)).toBeNull();
  });
});

describe('isSnapshotExpired', () => {
  const cutoff = new Date('2026-01-01T00:00:00Z');

  it('is true for a filename timestamped before the cutoff', () => {
    const ts = cutoff.getTime() - 1000;
    expect(isSnapshotExpired(`${ts}-abc123.html`, cutoff)).toBe(true);
  });

  it('is false for a filename timestamped at or after the cutoff', () => {
    expect(isSnapshotExpired(`${cutoff.getTime()}-abc123.html`, cutoff)).toBe(false);
  });

  it('is false for a filename with no leading timestamp', () => {
    expect(isSnapshotExpired('not-a-snapshot.html', cutoff)).toBe(false);
  });
});

describe('retention stage', () => {
  it('purges nothing when fewer than keepCompletedRuns runs have succeeded', () => {
    const { post } = repos.posts.insertOrTouch({
      hash: 'h1',
      authorName: 'Author',
      content: 'real content',
      firstSeenRunId: ctx.run.id,
      collectedAt: new Date('2020-01-01T00:00:00Z'),
    });

    retention.run(ctx);

    expect(repos.posts.get(post.id)!.content).toBe('real content');
    expect(repos.posts.get(post.id)!.contentPurgedAt).toBeNull();
  });

  it('purges post text/OCR text/images collected before the cutoff, keeps analysis and job rows', () => {
    const { post } = repos.posts.insertOrTouch({
      hash: 'h2',
      authorName: 'Author',
      content: 'real content',
      firstSeenRunId: ctx.run.id,
      collectedAt: new Date('2020-01-01T00:00:00Z'),
    });
    repos.posts.updateStatus(post.id, 'digested', { ocrText: 'ocr text' });
    repos.postAnalysis.upsert({
      postId: post.id,
      categories: { software_engineering: 0.9 },
      primaryCategory: 'software_engineering',
      relevance: 0.9,
      classifier: 'fake',
      model: 'fake-model',
      processedAt: new Date(),
    });
    repos.jobOpenings.insert({
      postId: post.id,
      company: 'Acme',
      role: 'Engineer',
      location: null,
      remoteStatus: null,
      seniority: null,
      experience: null,
      skills: [],
      model: 'fake-model',
    });
    const imagePath = path.join(tmpDir, 'a.png');
    fs.writeFileSync(imagePath, 'fake bytes');
    repos.postImages.add(post.id, imagePath);

    succeedRunAt(new Date('2026-01-01T00:00:00Z'));
    succeedRunAt(new Date('2026-01-02T00:00:00Z'));

    retention.run(ctx);

    const updated = repos.posts.get(post.id)!;
    expect(updated.content).toBe('');
    expect(updated.ocrText).toBeNull();
    expect(updated.contentPurgedAt).not.toBeNull();
    expect(repos.postImages.listForPost(post.id)).toHaveLength(0);
    expect(fs.existsSync(imagePath)).toBe(false);
    // Kept per grill Q7(c): categories/scores and job rows survive the purge.
    expect(repos.postAnalysis.get(post.id)!.primaryCategory).toBe('software_engineering');
    expect(repos.jobOpenings.listForPost(post.id)).toHaveLength(1);
  });

  it('does not purge a post collected after the cutoff', () => {
    const { post } = repos.posts.insertOrTouch({
      hash: 'h3',
      authorName: 'Author',
      content: 'still fresh',
      firstSeenRunId: ctx.run.id,
      collectedAt: new Date('2026-06-01T00:00:00Z'),
    });
    succeedRunAt(new Date('2026-01-01T00:00:00Z'));
    succeedRunAt(new Date('2026-01-02T00:00:00Z'));

    retention.run(ctx);

    expect(repos.posts.get(post.id)!.content).toBe('still fresh');
  });

  it('deletes expired snapshot files and leaves fresh ones alone', () => {
    const snapshotsDir = path.join(tmpDir, 'snapshots');
    fs.mkdirSync(snapshotsDir, { recursive: true });
    const oldFile = path.join(snapshotsDir, `${new Date('2025-01-01T00:00:00Z').getTime()}-old.html`);
    const newFile = path.join(snapshotsDir, `${Date.now()}-new.html`);
    fs.writeFileSync(oldFile, '<html>old</html>');
    fs.writeFileSync(newFile, '<html>new</html>');

    succeedRunAt(new Date('2026-01-01T00:00:00Z'));
    succeedRunAt(new Date('2026-01-02T00:00:00Z'));

    retention.run(ctx);

    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);
  });
});
