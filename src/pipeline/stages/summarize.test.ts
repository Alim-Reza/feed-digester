import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../../db/testHelpers';
import { createRepositories, type Repositories } from '../../db/repositories';
import { loadConfig } from '../../config';
import { newId } from '../../db/ids';
import { runSummarizeStage } from './summarize';
import type { Summarizer } from '../../services/summarization/summarizer';
import type { InsightEvaluation } from '../../services/summarization/types';
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

function seedDigestWithCluster(category: string, memberCount: number) {
  const digestId = newId();
  const now = new Date();
  repos.digests.insert({ id: digestId, runId: ctx.run.id, windowStart: now, windowEnd: now, createdAt: now, stats: {} });
  const clusterId = newId();
  repos.topicClusters.insert({ id: clusterId, digestId, category, title: '', summary: '', score: 1 });
  for (let i = 0; i < memberCount; i += 1) {
    const { post } = repos.posts.insertOrTouch({
      hash: `${clusterId}-${i}`,
      authorName: 'Author',
      content: `Post ${i}`,
      firstSeenRunId: 'r1',
      collectedAt: now,
    });
    repos.posts.updateStatus(post.id, 'clustered');
    repos.topicClusterPosts.insert({ clusterId, postId: post.id, rank: i });
  }
  return { digestId, clusterId };
}

const validInsight: InsightEvaluation = {
  isInsight: true,
  title: 'A concrete insight',
  summary: 'A concrete summary.',
  whyItMatters: 'Because it matters.',
  suggestedAction: null,
  noveltyLevel: 'high',
  confidence: 'medium',
};

function fakeSummarizer(overrides: Partial<Summarizer> = {}): Summarizer {
  return {
    evaluateCluster: vi.fn().mockResolvedValue(validInsight),
    release: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('runSummarizeStage', () => {
  it('does nothing when there is no digest for this run', async () => {
    await runSummarizeStage(ctx, () => fakeSummarizer());
    expect(repos.digestSections.listForDigest('nonexistent')).toEqual([]);
  });

  it('writes an insight onto a cluster judged worth keeping', async () => {
    const { digestId, clusterId } = seedDigestWithCluster('software_engineering', 2);
    const summarizer = fakeSummarizer();

    await runSummarizeStage(ctx, () => summarizer);

    const clusters = repos.topicClusters.listForDigest(digestId);
    const cluster = clusters.find((c) => c.id === clusterId)!;
    expect(cluster).toMatchObject({
      title: validInsight.title,
      summary: validInsight.summary,
      whyItMatters: validInsight.whyItMatters,
      noveltyLevel: 'high',
      confidence: 'medium',
    });
  });

  it('leaves a cluster judged not-an-insight untouched (empty title)', async () => {
    const { digestId, clusterId } = seedDigestWithCluster('career', 1);
    const summarizer = fakeSummarizer({
      evaluateCluster: vi.fn().mockResolvedValue({ isInsight: false }),
    });

    await runSummarizeStage(ctx, () => summarizer);

    const clusters = repos.topicClusters.listForDigest(digestId);
    expect(clusters.find((c) => c.id === clusterId)!.title).toBe('');
  });

  it('leaves the cluster unfeatured when the LLM call fails, without failing the run', async () => {
    const { digestId, clusterId } = seedDigestWithCluster('career', 1);
    const summarizer = fakeSummarizer({
      evaluateCluster: vi.fn().mockRejectedValue(new Error('ollama unreachable')),
    });

    await runSummarizeStage(ctx, () => summarizer);

    const clusters = repos.topicClusters.listForDigest(digestId);
    expect(clusters.find((c) => c.id === clusterId)!.title).toBe('');
  });

  it('passes the configured personalization profile through to the evaluator', async () => {
    seedDigestWithCluster('ai_ml', 1);
    const evaluateCluster = vi.fn().mockResolvedValue(validInsight);
    const config = { ...ctx.config, profile: { interests: ['agents'], goals: [], alreadyFamiliarWith: [] } };
    ctx = { ...ctx, config };

    await runSummarizeStage(ctx, () => fakeSummarizer({ evaluateCluster }));

    expect(evaluateCluster).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      config.profile,
    );
  });

  it('releases the summarizer exactly once', async () => {
    seedDigestWithCluster('job', 1);
    const summarizer = fakeSummarizer();

    await runSummarizeStage(ctx, () => summarizer);

    expect(summarizer.release).toHaveBeenCalledOnce();
  });
});
