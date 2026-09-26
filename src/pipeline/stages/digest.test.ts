import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../db/testHelpers';
import { createRepositories, type Repositories } from '../../db/repositories';
import { loadConfig } from '../../config';
import { newId } from '../../db/ids';
import { runDigestStage } from './digest';
import type { StageContext } from '../types';
import type { InsightLevel } from '../../db/schema';

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

function seedCluster(opts: {
  digestId: string;
  category: string;
  title: string;
  noveltyLevel?: InsightLevel;
  cohesion?: number;
  members?: number;
}) {
  const clusterId = newId();
  repos.topicClusters.insert({
    id: clusterId,
    digestId: opts.digestId,
    category: opts.category,
    title: opts.title,
    summary: opts.title === '' ? '' : 'A concrete summary.',
    score: opts.cohesion ?? 0.8,
  });
  if (opts.title !== '') {
    repos.topicClusters.updateInsight(clusterId, {
      title: opts.title,
      summary: 'A concrete summary.',
      whyItMatters: 'Because.',
      suggestedAction: null,
      noveltyLevel: opts.noveltyLevel ?? 'medium',
      confidence: 'medium',
    });
  }
  const now = new Date();
  for (let i = 0; i < (opts.members ?? 1); i += 1) {
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
  return clusterId;
}

describe('runDigestStage', () => {
  it('does nothing when there is no digest for this run', async () => {
    await runDigestStage(ctx);
    expect(repos.posts.countByStatus('digested')).toBe(0);
  });

  it('advances every clustered post to digested and writes job market stats', async () => {
    const digestId = newId();
    const now = new Date();
    repos.digests.insert({ id: digestId, runId: ctx.run.id, windowStart: now, windowEnd: now, createdAt: now, stats: {} });
    const clusterId = seedCluster({ digestId, category: 'job', title: 'Hiring insight' });
    const [{ postId }] = repos.topicClusterPosts.listForCluster(clusterId);
    repos.jobOpenings.insert({
      postId,
      company: 'Acme',
      role: 'Engineer',
      location: null,
      remoteStatus: null,
      seniority: null,
      experience: null,
      skills: ['Go'],
      model: 'fake-model',
    });

    await runDigestStage(ctx);

    expect(repos.posts.get(postId)!.processingStatus).toBe('digested');
    const digestRow = repos.digests.get(digestId)!;
    expect(digestRow.stats).toMatchObject({
      totalPosts: 1,
      postsUseful: 1,
      postsFilteredNoise: 0,
      jobMarket: { totalOpenings: 1, companies: [{ name: 'Acme', count: 1 }] },
    });
  });

  it('assigns rank 1..maxInsights to the top-ranked insights and leaves the rest null', async () => {
    const digestId = newId();
    const now = new Date();
    repos.digests.insert({ id: digestId, runId: ctx.run.id, windowStart: now, windowEnd: now, createdAt: now, stats: {} });
    ctx = { ...ctx, config: { ...ctx.config, briefing: { ...ctx.config.briefing, maxInsights: 1 } } };

    const low = seedCluster({ digestId, category: 'career', title: 'Obvious advice', noveltyLevel: 'low' });
    const high = seedCluster({ digestId, category: 'ai_ml', title: 'A sharp technical insight', noveltyLevel: 'high' });

    await runDigestStage(ctx);

    const clusters = repos.topicClusters.listForDigest(digestId);
    expect(clusters.find((c) => c.id === high)!.rank).toBe(1);
    expect(clusters.find((c) => c.id === low)!.rank).toBeNull();
  });

  it('counts noise clusters as filtered, not useful, and excludes them from digestSections', async () => {
    const digestId = newId();
    const now = new Date();
    repos.digests.insert({ id: digestId, runId: ctx.run.id, windowStart: now, windowEnd: now, createdAt: now, stats: {} });
    seedCluster({ digestId, category: 'career', title: '' }); // noise: never called updateInsight

    await runDigestStage(ctx);

    const digestRow = repos.digests.get(digestId)!;
    expect(digestRow.stats).toMatchObject({ postsUseful: 0, postsFilteredNoise: 1 });
  });

  it('counts non-representative cluster members as duplicates merged', async () => {
    const digestId = newId();
    const now = new Date();
    repos.digests.insert({ id: digestId, runId: ctx.run.id, windowStart: now, windowEnd: now, createdAt: now, stats: {} });
    seedCluster({ digestId, category: 'ai_ml', title: 'Merged insight', members: 3 });

    await runDigestStage(ctx);

    const digestRow = repos.digests.get(digestId)!;
    expect(digestRow.stats).toMatchObject({ duplicatesMerged: 2, postsUseful: 3 });
  });
});
