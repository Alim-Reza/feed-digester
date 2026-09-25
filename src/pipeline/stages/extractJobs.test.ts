import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../../db/testHelpers';
import { createRepositories, type Repositories } from '../../db/repositories';
import { loadConfig } from '../../config';
import { runExtractJobsStage } from './extractJobs';
import type { JobExtractor } from '../../services/jobs/extractor';
import type { JobExtractionResult } from '../../services/jobs/types';
import type { StageContext } from '../types';

const logger = pino({ level: 'silent' });

let repos: Repositories;
let ctx: StageContext;

beforeEach(() => {
  const db = createTestDb();
  repos = createRepositories(db);
  const config = loadConfig();
  const run = repos.runs.create('manual');
  ctx = { db, repos, config, logger, run };
});

function seedClassified(hash: string, jobScore: number) {
  const { post } = repos.posts.insertOrTouch({
    hash,
    authorName: 'Author',
    content: 'Some post content',
    firstSeenRunId: 'r1',
    collectedAt: new Date(),
  });
  repos.posts.updateStatus(post.id, 'classified');
  repos.postAnalysis.upsert({
    postId: post.id,
    categories: { job: jobScore },
    primaryCategory: jobScore > 0.5 ? 'job' : 'software_engineering',
    relevance: 0.9,
    classifier: 'fake',
    model: 'fake-model',
    processedAt: new Date(),
  });
  return post;
}

function fakeExtractor(
  extractBatch: JobExtractor['extractBatch'],
): { extractor: JobExtractor; release: ReturnType<typeof vi.fn> } {
  const release = vi.fn().mockResolvedValue(undefined);
  return { extractor: { model: 'fake-model', extractBatch, release }, release };
}

const hiringResult: JobExtractionResult = {
  isHiringPost: true,
  roles: [
    {
      company: 'Acme',
      role: 'Engineer',
      location: null,
      remoteStatus: null,
      seniority: null,
      experience: null,
      skills: ['Go'],
    },
  ],
};

describe('runExtractJobsStage', () => {
  it('advances a below-threshold post to enriched without calling the extractor', async () => {
    const post = seedClassified('h1', 0.1);
    const createExtractor = vi.fn();

    await runExtractJobsStage(ctx, createExtractor);

    expect(createExtractor).not.toHaveBeenCalled();
    expect(repos.posts.get(post.id)!.processingStatus).toBe('enriched');
    expect(repos.jobOpenings.listForPost(post.id)).toHaveLength(0);
  });

  it('extracts and stores roles for a hiring post above threshold, then advances it', async () => {
    const post = seedClassified('h2', 0.9);
    const { extractor } = fakeExtractor(async () => [hiringResult]);

    await runExtractJobsStage(ctx, () => extractor);

    expect(repos.posts.get(post.id)!.processingStatus).toBe('enriched');
    const roles = repos.jobOpenings.listForPost(post.id);
    expect(roles).toHaveLength(1);
    expect(roles[0]!.role).toBe('Engineer');
    expect(roles[0]!.skills).toEqual(['Go']);
  });

  it('advances a job-scored post to enriched with no rows when the LLM says it is not a hiring post', async () => {
    const post = seedClassified('h3', 0.9);
    const { extractor } = fakeExtractor(async () => [{ isHiringPost: false, roles: [] }]);

    await runExtractJobsStage(ctx, () => extractor);

    expect(repos.posts.get(post.id)!.processingStatus).toBe('enriched');
    expect(repos.jobOpenings.listForPost(post.id)).toHaveLength(0);
  });

  it('records a per-post attempt failure for the extracted subset without blocking the skip subset', async () => {
    const skipped = seedClassified('h4', 0.1);
    const failing = seedClassified('h5', 0.9);
    const { extractor } = fakeExtractor(async () => {
      throw new Error('ollama unreachable');
    });

    await runExtractJobsStage(ctx, () => extractor);

    expect(repos.posts.get(skipped.id)!.processingStatus).toBe('enriched');
    const failingUpdated = repos.posts.get(failing.id)!;
    expect(failingUpdated.processingStatus).toBe('classified');
    expect(failingUpdated.attempts).toBe(1);
    expect(failingUpdated.lastError).toBe('ollama unreachable');
  });

  it('releases the extractor exactly once, only when it was actually created', async () => {
    seedClassified('h6', 0.9);
    const { extractor, release } = fakeExtractor(async (inputs) => inputs.map(() => hiringResult));

    await runExtractJobsStage(ctx, () => extractor);

    expect(release).toHaveBeenCalledOnce();
  });
});
