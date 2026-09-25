import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../../db/testHelpers';
import { createRepositories, type Repositories } from '../../db/repositories';
import { loadConfig } from '../../config';
import { runClassifyStage } from './classify';
import type { Classifier, ClassificationResult } from '../../services/classification/types';
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

function seedFiltered(hash: string) {
  const { post } = repos.posts.insertOrTouch({
    hash,
    authorName: 'Author',
    content: 'Some post content',
    firstSeenRunId: 'r1',
    collectedAt: new Date(),
  });
  repos.posts.updateStatus(post.id, 'filtered');
  return post;
}

function fakeClassifier(
  classifyBatch: Classifier['classifyBatch'],
  overrides: Partial<Pick<Classifier, 'name' | 'model'>> = {},
): { classifier: Classifier; release: ReturnType<typeof vi.fn> } {
  const release = vi.fn().mockResolvedValue(undefined);
  return {
    classifier: {
      name: overrides.name ?? 'fake',
      model: overrides.model ?? 'fake-model',
      classifyBatch,
      release,
    },
    release,
  };
}

function result(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return {
    categories: { software_engineering: 0.9, ai_ml: 0.1, career: 0, engineering_leadership: 0, industry_news: 0, job: 0 },
    primaryCategory: 'software_engineering',
    relevance: 0.9,
    ...overrides,
  };
}

describe('runClassifyStage', () => {
  it('advances a post at or above the relevance threshold to classified and stores its analysis', async () => {
    const post = seedFiltered('h1');
    const { classifier } = fakeClassifier(async () => [result({ relevance: 0.9 })]);

    await runClassifyStage(ctx, () => classifier);

    const updated = repos.posts.get(post.id)!;
    expect(updated.processingStatus).toBe('classified');
    const analysis = repos.postAnalysis.get(post.id)!;
    expect(analysis.primaryCategory).toBe('software_engineering');
    expect(analysis.relevance).toBe(0.9);
    expect(analysis.classifier).toBe('fake');
  });

  it('drops a post below the relevance threshold but still records its analysis', async () => {
    const post = seedFiltered('h2');
    const { classifier } = fakeClassifier(async () => [result({ relevance: 0.1 })]);

    await runClassifyStage(ctx, () => classifier);

    const updated = repos.posts.get(post.id)!;
    expect(updated.processingStatus).toBe('dropped');
    expect(updated.dropReason).toBe('low_relevance');
    expect(repos.postAnalysis.get(post.id)).toBeDefined();
  });

  it('records a per-post attempt failure instead of crashing the run when a batch fails', async () => {
    const post = seedFiltered('h3');
    const { classifier } = fakeClassifier(async () => {
      throw new Error('ollama unreachable');
    });

    await runClassifyStage(ctx, () => classifier);

    const updated = repos.posts.get(post.id)!;
    expect(updated.processingStatus).toBe('filtered');
    expect(updated.attempts).toBe(1);
    expect(updated.lastError).toBe('ollama unreachable');
  });

  it('releases the classifier exactly once even across multiple batches', async () => {
    for (let i = 0; i < 3; i += 1) seedFiltered(`h-multi-${i}`);
    const { classifier, release } = fakeClassifier(async (inputs) =>
      inputs.map(() => result()),
    );

    await runClassifyStage(ctx, () => classifier);

    expect(release).toHaveBeenCalledOnce();
  });
});
