import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testHelpers';
import { createPostsRepository, type PostsRepository } from './posts';
import { createRunsRepository } from './runs';

let repo: PostsRepository;
let runId: string;

beforeEach(() => {
  const db = createTestDb();
  repo = createPostsRepository(db);
  const runs = createRunsRepository(db);
  runId = runs.create('manual').id;
});

function samplePost(overrides: Partial<Parameters<PostsRepository['insertOrTouch']>[0]> = {}) {
  return {
    hash: 'hash-1',
    externalId: 'urn:li:activity:123',
    authorName: 'Ada Lovelace',
    content: 'Some post content',
    firstSeenRunId: runId,
    collectedAt: new Date('2026-09-25T08:00:00Z'),
    ...overrides,
  };
}

describe('postsRepository', () => {
  it('inserts a new post as "new"', () => {
    const { post, inserted } = repo.insertOrTouch(samplePost());
    expect(inserted).toBe(true);
    expect(post.processingStatus).toBe('new');
    expect(post.attempts).toBe(0);
  });

  it('dedupes on externalId and only touches lastSeenAt', () => {
    const first = repo.insertOrTouch(samplePost());
    const second = repo.insertOrTouch(
      samplePost({ collectedAt: new Date('2026-09-25T09:00:00Z'), content: 'different text' }),
    );
    expect(second.inserted).toBe(false);
    expect(second.post.id).toBe(first.post.id);
    expect(second.post.content).toBe(first.post.content); // untouched
    expect(repo.countByStatus('new')).toBe(1);
  });

  it('dedupes on hash when externalId is absent', () => {
    const first = repo.insertOrTouch(samplePost({ externalId: null }));
    const second = repo.insertOrTouch(samplePost({ externalId: null }));
    expect(second.inserted).toBe(false);
    expect(second.post.id).toBe(first.post.id);
  });

  it('moves posts through processingStatus', () => {
    const { post } = repo.insertOrTouch(samplePost());
    repo.updateStatus(post.id, 'filtered');
    expect(repo.get(post.id)?.processingStatus).toBe('filtered');
    expect(repo.listByStatus('filtered', 10)).toHaveLength(1);
  });

  it('drops a post with a reason', () => {
    const { post } = repo.insertOrTouch(samplePost());
    repo.drop(post.id, 'sponsored');
    const dropped = repo.get(post.id)!;
    expect(dropped.processingStatus).toBe('dropped');
    expect(dropped.dropReason).toBe('sponsored');
  });

  it('marks a post failed after maxAttempts', () => {
    const { post } = repo.insertOrTouch(samplePost());
    repo.recordAttemptFailure(post.id, 'boom', 3);
    repo.recordAttemptFailure(post.id, 'boom again', 3);
    const current = repo.recordAttemptFailure(post.id, 'boom thrice', 3);
    expect(current.attempts).toBe(3);
    expect(current.processingStatus).toBe('failed');
    expect(repo.listFailed()).toHaveLength(1);
  });

  it('list() filters by status', () => {
    const { post: kept } = repo.insertOrTouch(samplePost({ hash: 'h-kept', externalId: null }));
    repo.updateStatus(kept.id, 'filtered');
    const { post: dropped } = repo.insertOrTouch(samplePost({ hash: 'h-dropped', externalId: null }));
    repo.drop(dropped.id, 'sponsored');

    expect(repo.list({ status: 'filtered' }).map((p) => p.id)).toEqual([kept.id]);
    expect(repo.list({ status: 'dropped' }).map((p) => p.id)).toEqual([dropped.id]);
  });

  it('list() filters by a substring in author name or content', () => {
    repo.insertOrTouch(
      samplePost({ hash: 'h-a', externalId: null, authorName: 'Jane Doe', content: 'about rust' }),
    );
    repo.insertOrTouch(
      samplePost({ hash: 'h-b', externalId: null, authorName: 'John Roe', content: 'about go' }),
    );

    expect(repo.list({ q: 'jane' }).map((p) => p.authorName)).toEqual(['Jane Doe']);
    expect(repo.list({ q: 'rust' }).map((p) => p.authorName)).toEqual(['Jane Doe']);
  });

  it('list() with no filters returns everything, newest collected first', () => {
    repo.insertOrTouch(
      samplePost({ hash: 'h-old', externalId: null, collectedAt: new Date('2026-09-20T00:00:00Z') }),
    );
    repo.insertOrTouch(
      samplePost({ hash: 'h-new', externalId: null, collectedAt: new Date('2026-09-25T00:00:00Z') }),
    );

    expect(repo.list().map((p) => p.hash)).toEqual(['h-new', 'h-old']);
  });
});
