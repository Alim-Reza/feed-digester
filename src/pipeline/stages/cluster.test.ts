import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../../db/testHelpers';
import { createRepositories, type Repositories } from '../../db/repositories';
import { loadConfig } from '../../config';
import { runClusterStage } from './cluster';
import type { Embedder } from '../../llm/types';
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

function seedEnriched(hash: string, category: string, content = 'content') {
  const { post } = repos.posts.insertOrTouch({
    hash,
    authorName: 'Author',
    content,
    firstSeenRunId: 'r1',
    collectedAt: new Date(),
  });
  repos.posts.updateStatus(post.id, 'enriched');
  repos.postAnalysis.upsert({
    postId: post.id,
    categories: { [category]: 0.9 },
    primaryCategory: category,
    relevance: 0.9,
    classifier: 'fake',
    model: 'fake-model',
    processedAt: new Date(),
  });
  return post;
}

function fakeEmbedder(embed: Embedder['embed']): Embedder {
  return { name: 'fake', embed, release: vi.fn().mockResolvedValue(undefined) };
}

describe('runClusterStage', () => {
  it('does nothing and creates no digest when there are no enriched posts', async () => {
    await runClusterStage(ctx, () => fakeEmbedder(vi.fn()));

    expect(repos.digests.getByRunId(ctx.run.id)).toBeUndefined();
  });

  it('clusters similar posts within a category into one topic cluster', async () => {
    const a = seedEnriched('h1', 'software_engineering');
    const b = seedEnriched('h2', 'software_engineering');
    const embed = vi.fn().mockResolvedValue([
      [1, 0, 0],
      [0.99, 0.01, 0],
    ]);

    await runClusterStage(ctx, () => fakeEmbedder(embed));

    const digestRow = repos.digests.getByRunId(ctx.run.id)!;
    const clusters = repos.topicClusters.listForDigest(digestRow.id);
    expect(clusters).toHaveLength(1);
    const members = repos.topicClusterPosts.listForCluster(clusters[0]!.id);
    expect(members.map((m) => m.postId).sort()).toEqual([a.id, b.id].sort());
    expect(repos.posts.get(a.id)!.processingStatus).toBe('clustered');
    expect(repos.posts.get(b.id)!.processingStatus).toBe('clustered');
  });

  it('keeps dissimilar posts in separate clusters, and separates by category', async () => {
    seedEnriched('h3', 'software_engineering');
    seedEnriched('h4', 'career');
    const embed = vi.fn().mockResolvedValue([
      [1, 0, 0],
      [0, 1, 0],
    ]);

    await runClusterStage(ctx, () => fakeEmbedder(embed));

    const digestRow = repos.digests.getByRunId(ctx.run.id)!;
    const clusters = repos.topicClusters.listForDigest(digestRow.id);
    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.category).sort()).toEqual(['career', 'software_engineering']);
  });

  it('releases the embedder even when clustering succeeds', async () => {
    seedEnriched('h5', 'ai_ml');
    const release = vi.fn().mockResolvedValue(undefined);
    const embed = vi.fn().mockResolvedValue([[1, 0, 0]]);

    await runClusterStage(ctx, () => ({ name: 'fake', embed, release }));

    expect(release).toHaveBeenCalledOnce();
  });
});
