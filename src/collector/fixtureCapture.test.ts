import { describe, expect, it } from 'vitest';
import { fixtureId, selectNewFixtures } from './fixtureCapture';

describe('fixtureId', () => {
  it('uses a sanitized URN when present', () => {
    expect(fixtureId({ urn: 'urn:li:activity:123', html: '<div/>' })).toBe('urn_li_activity_123');
  });

  it('strips characters unsafe for a filename', () => {
    expect(fixtureId({ urn: 'urn:li:activity:123?x=1', html: '<div/>' })).toBe(
      'urn_li_activity_123_x_1',
    );
  });

  it('falls back to a content hash when there is no URN', () => {
    const id = fixtureId({ urn: null, html: '<div>hello</div>' });
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is stable for identical content without a URN', () => {
    const a = fixtureId({ urn: null, html: '<div>hello</div>' });
    const b = fixtureId({ urn: null, html: '<div>hello</div>' });
    expect(a).toBe(b);
  });
});

describe('selectNewFixtures', () => {
  it('skips posts already in seenIds', () => {
    const posts = [
      { urn: 'urn:li:activity:1', html: '<div>a</div>' },
      { urn: 'urn:li:activity:2', html: '<div>b</div>' },
    ];
    const result = selectNewFixtures(posts, new Set(['urn_li_activity_1']));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('urn_li_activity_2');
  });

  it('dedupes repeats within the same batch (e.g. a repost seen twice while scrolling)', () => {
    const posts = [
      { urn: 'urn:li:activity:1', html: '<div>a</div>' },
      { urn: 'urn:li:activity:1', html: '<div>a</div>' },
    ];
    const result = selectNewFixtures(posts, new Set());
    expect(result).toHaveLength(1);
  });

  it('sanitizes the html of each returned fixture', () => {
    const posts = [{ urn: 'urn:li:activity:1', html: '<div>a<script>evil()</script></div>' }];
    const result = selectNewFixtures(posts, new Set());
    expect(result[0].html).not.toContain('script');
  });
});
