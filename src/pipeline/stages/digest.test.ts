import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../db/testHelpers';
import { createRepositories, type Repositories } from '../../db/repositories';
import { loadConfig } from '../../config';
import { newId } from '../../db/ids';
import { runDigestStage } from './digest';
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

describe('runDigestStage', () => {
  it('does nothing when there is no digest for this run', async () => {
    await runDigestStage(ctx);
    expect(repos.posts.countByStatus('digested')).toBe(0);
  });

  it('advances every clustered post in the digest to digested and writes job market stats', async () => {
    const digestId = newId();
    const now = new Date();
    repos.digests.insert({ id: digestId, runId: ctx.run.id, windowStart: now, windowEnd: now, createdAt: now, stats: {} });
    const clusterId = newId();
    repos.topicClusters.insert({ id: clusterId, digestId, category: 'job', title: 'Hiring', summary: { bullets: [] }, score: 1 });

    const { post } = repos.posts.insertOrTouch({
      hash: 'h1',
      authorName: 'Recruiter',
      content: 'We are hiring',
      firstSeenRunId: 'r1',
      collectedAt: now,
    });
    repos.posts.updateStatus(post.id, 'clustered');
    repos.topicClusterPosts.insert({ clusterId, postId: post.id, rank: 0 });
    repos.jobOpenings.insert({
      postId: post.id,
      company: 'Acme',
      role: 'Engineer',
      location: null,
      remoteStatus: null,
      seniority: null,
      experience: null,
      skills: ['Go'],
      model: 'fake-model',
    });
    repos.digestSections.insert({ id: newId(), digestId, category: 'job', tldr: 'Hiring news.', postCount: 1, order: 0 });

    await runDigestStage(ctx);

    expect(repos.posts.get(post.id)!.processingStatus).toBe('digested');
    const digestRow = repos.digests.get(digestId)!;
    expect(digestRow.stats).toMatchObject({
      totalPosts: 1,
      jobMarket: { totalOpenings: 1, companies: [{ name: 'Acme', count: 1 }] },
    });
  });
});
