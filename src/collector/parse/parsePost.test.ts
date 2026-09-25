import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePost } from './parsePost';

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'linkedin');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, `${name}.html`), 'utf8');
}

const fixtureFiles = fs
  .readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith('.html') && !f.startsWith('_'));

describe('parsePost against every saved fixture', () => {
  it('has at least 30 fixtures to test against', () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(30);
  });

  it.each(fixtureFiles)('parses %s without a parseError', (file) => {
    const html = fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf8');
    const draft = parsePost(html);
    expect(draft.parseError).toBeNull();
    expect(draft.authorName.length).toBeGreaterThan(0);
    expect(draft.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('parsePost field extraction', () => {
  it('detects a sponsored post', () => {
    const draft = parsePost(loadFixture('sponsored-post'));
    expect(draft.isSponsored).toBe(true);
  });

  it('does not flag a normal post as sponsored', () => {
    const draft = parsePost(loadFixture('text-basic'));
    expect(draft.isSponsored).toBe(false);
  });

  it('detects video from a <video> tag', () => {
    expect(parsePost(loadFixture('video-post')).contentType).toBe('video');
    expect(parsePost(loadFixture('short-video-little-text')).contentType).toBe('video');
  });

  it('defaults poll/image/article/document to "text" (not confidently detectable yet — see selectors.ts)', () => {
    // Every post has an author avatar <img>, so guessing at "content image" markup risks
    // false-positiving every single post; safer to under-detect than mislabel everything.
    expect(parsePost(loadFixture('poll-post')).contentType).toBe('text');
    expect(parsePost(loadFixture('image-post')).contentType).toBe('text');
    expect(parsePost(loadFixture('article-share')).contentType).toBe('text');
    expect(parsePost(loadFixture('document-carousel')).contentType).toBe('text');
  });

  it('extracts the reposter as viaName', () => {
    const draft = parsePost(loadFixture('repost-with-via'));
    expect(draft.viaName).toBe('Jane Doe');
  });

  it('leaves viaName null for a non-repost', () => {
    expect(parsePost(loadFixture('text-basic')).viaName).toBeNull();
  });

  it('flags a connection-suggestion card', () => {
    expect(parsePost(loadFixture('connection-suggestion')).isConnectionSuggestion).toBe(true);
  });

  it('falls back to a content hash and estimated (not exact) time when there is no data-urn', () => {
    const draft = parsePost(loadFixture('no-urn-hash-fallback'));
    expect(draft.externalId).toBeNull();
    expect(draft.url).toBeNull();
    // No URN to decode exactly, but the post still shows a relative timestamp ("3d" by
    // default in the fixture template), so publishedAt falls back to an estimate from that.
    expect(draft.publishedAt).toBeInstanceOf(Date);
    expect(draft.publishedAtPrecision).toBe('estimated');
  });

  it('marks publishedAtPrecision "exact" when a URN is present', () => {
    const draft = parsePost(loadFixture('text-basic'));
    expect(draft.publishedAtPrecision).toBe('exact');
    expect(draft.publishedAt).toBeInstanceOf(Date);
  });

  it('marks publishedAtPrecision "estimated" from relative time text when there is a URN but timestamp parsing still exercises the relative path', () => {
    // relative-time-seconds has no URN, so it must fall back to relative text.
    const draft = parsePost(loadFixture('relative-time-seconds'));
    expect(draft.publishedAtPrecision).toBe('estimated');
    expect(draft.publishedAt).toBeInstanceOf(Date);
  });

  it('flags hasMoreText when a "see more" toggle is present', () => {
    expect(parsePost(loadFixture('text-long-seemore')).hasMoreText).toBe(true);
    expect(parsePost(loadFixture('text-basic')).hasMoreText).toBe(false);
  });

  it('preserves non-Latin (Bangla) content', () => {
    const draft = parsePost(loadFixture('bangla-content'));
    expect(draft.authorName).toContain('রহিম');
    expect(draft.content).toContain('প্রকল্প');
  });

  it('builds a feed update URL from the URN', () => {
    const draft = parsePost(loadFixture('text-basic'));
    expect(draft.url).toContain('linkedin.com/feed/update/urn:li:activity:');
  });

  it('extracts the author name from the "Hide post by <Name>" control, not a "likes this" social-proof line above it', () => {
    const draft = parsePost(loadFixture('social-proof-before-name'));
    expect(draft.authorName).toBe('Popular Poster');
    expect(draft.authorHeadline).toBe('Well-known headline');
  });
});

describe('parsePost against real captured fixtures (2026-09-25 session)', () => {
  // These came from an actual logged-in LinkedIn feed via `pnpm collect:fixtures` /
  // `scripts/extract-fixtures-from-dump.ts` — a regression guard against the real thing,
  // not just synthetic guesses about LinkedIn's markup.
  it('extracts a plain post correctly', () => {
    const draft = parsePost(loadFixture('6d9d28d87591f241'));
    expect(draft.authorName).toBe('Sanchit Narula');
    expect(draft.authorHeadline).toContain('Nielsen');
    expect(draft.content).toContain('satisfaction');
    expect(draft.externalId).toBe('urn:li:activity:7508763104793669632');
    expect(draft.publishedAtPrecision).toBe('exact');
  });

  it('does not confuse a "likes this" line with the headline on a real post', () => {
    const draft = parsePost(loadFixture('1f675b9613594243'));
    expect(draft.authorName).toBe('Shubham Srivastava');
    expect(draft.authorHeadline).not.toMatch(/likes? this/i);
    expect(draft.authorHeadline).toContain('Data Engineer');
  });

  it('detects a real video post', () => {
    const draft = parsePost(loadFixture('a26e1fe509b770a2'));
    expect(draft.authorName).toBe('Ahmed Shamim Hassan');
    expect(draft.contentType).toBe('video');
  });
});
