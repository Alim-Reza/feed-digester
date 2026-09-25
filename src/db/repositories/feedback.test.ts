import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testHelpers';
import { createFeedbackRepository, type FeedbackRepository } from './feedback';
import { createPostsRepository } from './posts';
import { createRunsRepository } from './runs';

let repo: FeedbackRepository;
let postId: string;

beforeEach(() => {
  const db = createTestDb();
  repo = createFeedbackRepository(db);
  const runId = createRunsRepository(db).create('manual').id;
  postId = createPostsRepository(db).insertOrTouch({
    hash: 'h1',
    authorName: 'Author',
    firstSeenRunId: runId,
    collectedAt: new Date(),
  }).post.id;
});

describe('feedbackRepository', () => {
  it('adds and lists feedback for a post', () => {
    repo.add({ postId, kind: 'up' });
    repo.add({ postId, kind: 'label', value: { categories: ['ai_ml'], relevance: 1 } });

    const rows = repo.listForPost(postId);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.kind).sort()).toEqual(['label', 'up']);
  });

  it('listByKind returns only rows of that kind, across posts', () => {
    repo.add({ postId, kind: 'label', value: { categories: ['career'], relevance: 0.5 } });
    repo.add({ postId, kind: 'up' });

    const labels = repo.listByKind('label');
    expect(labels).toHaveLength(1);
    expect(labels[0]!.value).toEqual({ categories: ['career'], relevance: 0.5 });
  });
});
