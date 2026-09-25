import { describe, expect, it } from 'vitest';
import { createTestDb } from '../testHelpers';
import { createPostsRepository } from './posts';
import { createPostImagesRepository } from './postImages';

describe('postImagesRepository', () => {
  it('adds and lists images for a post, kept by default', () => {
    const db = createTestDb();
    const posts = createPostsRepository(db);
    const images = createPostImagesRepository(db);
    const { post } = posts.insertOrTouch({
      hash: 'h1',
      authorName: 'Author',
      firstSeenRunId: 'r1',
      collectedAt: new Date(),
    });

    images.add(post.id, '/tmp/a.png');
    images.add(post.id, '/tmp/b.png');

    const rows = images.listForPost(post.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.path).sort()).toEqual(['/tmp/a.png', '/tmp/b.png']);
    expect(rows.every((r) => r.kept)).toBe(true);
  });

  it('returns no rows for a post with no images', () => {
    const db = createTestDb();
    const posts = createPostsRepository(db);
    const images = createPostImagesRepository(db);
    const { post } = posts.insertOrTouch({
      hash: 'h2',
      authorName: 'Author',
      firstSeenRunId: 'r1',
      collectedAt: new Date(),
    });

    expect(images.listForPost(post.id)).toHaveLength(0);
  });
});
