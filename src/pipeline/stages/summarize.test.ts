import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../../db/testHelpers';
import { createRepositories, type Repositories } from '../../db/repositories';
import { loadConfig } from '../../config';
import { newId } from '../../db/ids';
import { runSummarizeStage } from './summarize';
import type { Summarizer } from '../../services/summarization/summarizer';
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
  repos.topicClusters.insert({ id: clusterId, digestId, category, title: '', summary: { bullets: [] }, score: 1 });
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

function fakeSummarizer(overrides: Partial<Summarizer> = {}): Summarizer {
  return {
    summarizeCluster: vi
      .fn()
      .mockResolvedValue({ title: 'A topic', bullets: [{ text: 'A bullet [1].', sources: [1] }] }),
    summarizeSection: vi.fn().mockResolvedValue('A section tldr.'),
    release: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('runSummarizeStage', () => {
  it('does nothing when there is no digest for this run', async () => {
    await runSummarizeStage(ctx, () => fakeSummarizer());
    expect(repos.digestSections.listForDigest('nonexistent')).toEqual([]);
  });

  it('writes a cluster title/bullets and a digest section with the summarized topic titles', async () => {
    const { digestId, clusterId } = seedDigestWithCluster('software_engineering', 2);
    const summarizer = fakeSummarizer();

    await runSummarizeStage(ctx, () => summarizer);

    const clusters = repos.topicClusters.listForDigest(digestId);
    expect(clusters.find((c) => c.id === clusterId)!.title).toBe('A topic');
    const sections = repos.digestSections.listForDigest(digestId);
    expect(sections).toHaveLength(1);
    expect(sections[0]!).toMatchObject({ category: 'software_engineering', tldr: 'A section tldr.', postCount: 2 });
  });

  it('falls back to a deterministic tldr and leaves the cluster unfeatured when the LLM call fails', async () => {
    const { digestId, clusterId } = seedDigestWithCluster('career', 1);
    const summarizer = fakeSummarizer({
      summarizeCluster: vi.fn().mockRejectedValue(new Error('ollama unreachable')),
    });

    await runSummarizeStage(ctx, () => summarizer);

    const clusters = repos.topicClusters.listForDigest(digestId);
    expect(clusters.find((c) => c.id === clusterId)!.title).toBe('');
    const sections = repos.digestSections.listForDigest(digestId);
    expect(sections[0]!.tldr).toMatch(/1 Career Advice post this cycle\./);
  });

  it('releases the summarizer exactly once', async () => {
    seedDigestWithCluster('job', 1);
    const summarizer = fakeSummarizer();

    await runSummarizeStage(ctx, () => summarizer);

    expect(summarizer.release).toHaveBeenCalledOnce();
  });
});
