import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '../../db/testHelpers';
import { createRepositories, type Repositories } from '../../db/repositories';
import { loadConfig } from '../../config';
import { decideFilter, filter, type FilterInput } from './filter';

const { filtering } = loadConfig();

function basePost(overrides: Partial<FilterInput> = {}): FilterInput {
  return {
    authorName: 'Jane Doe',
    content: 'A substantive post about distributed systems and how we scaled our queue.',
    contentType: 'text',
    ocrText: null,
    isSponsored: false,
    isConnectionSuggestion: false,
    isPoll: false,
    ...overrides,
  };
}

describe('decideFilter', () => {
  it('keeps a plain, substantive English post', () => {
    const outcome = decideFilter(basePost(), filtering);
    expect(outcome).toMatchObject({ keep: true, language: 'en' });
  });

  it('lets the allowlist override every other rule', () => {
    const config = { ...filtering, allowlist: ['jane doe'] };
    const outcome = decideFilter(basePost({ isSponsored: true }), config);
    expect(outcome).toMatchObject({ keep: true });
  });

  it('drops a blocklisted author', () => {
    const config = { ...filtering, blocklist: ['jane doe'] };
    const outcome = decideFilter(basePost(), config);
    expect(outcome).toMatchObject({ keep: false, reason: 'blocklisted' });
  });

  it('drops sponsored content', () => {
    const outcome = decideFilter(basePost({ isSponsored: true }), filtering);
    expect(outcome).toMatchObject({ keep: false, reason: 'sponsored' });
  });

  it('drops connection suggestions', () => {
    const outcome = decideFilter(basePost({ isConnectionSuggestion: true }), filtering);
    expect(outcome).toMatchObject({ keep: false, reason: 'connection_suggestion' });
  });

  it('drops polls', () => {
    const outcome = decideFilter(basePost({ isPoll: true }), filtering);
    expect(outcome).toMatchObject({ keep: false, reason: 'poll' });
  });

  it('drops a generic celebration post', () => {
    const outcome = decideFilter(
      basePost({ content: "I'm happy to share that I started a new role today!" }),
      filtering,
    );
    expect(outcome).toMatchObject({ keep: false, reason: 'celebration' });
  });

  it('drops generic motivational filler (spec-second.md §2)', () => {
    const outcome = decideFilter(
      basePost({ content: 'Never give up on your dreams. Keep learning every single day.' }),
      filtering,
    );
    expect(outcome).toMatchObject({ keep: false, reason: 'low_value_phrase' });
  });

  it('keeps a celebration-shaped post that is actually substantive (only the exact phrase triggers it)', () => {
    const outcome = decideFilter(
      basePost({
        content:
          'I got promoted to Staff Engineer — here is what I learned along the way about system design.',
      }),
      filtering,
    );
    expect(outcome).toMatchObject({ keep: true });
  });

  it('drops a video post with little accompanying text', () => {
    const outcome = decideFilter(
      basePost({ contentType: 'video', content: 'Check this out' }),
      filtering,
    );
    expect(outcome).toMatchObject({ keep: false, reason: 'video_low_text' });
  });

  it('keeps a video post with enough accompanying text', () => {
    const outcome = decideFilter(
      basePost({ contentType: 'video', content: 'x'.repeat(filtering.minVideoTextLength + 1) }),
      filtering,
    );
    expect(outcome).toMatchObject({ keep: true });
  });

  it('drops a post in a disallowed language', () => {
    const outcome = decideFilter(
      basePost({
        content: "Ceci est une phrase en français pour tester la détection de langue aujourd'hui.",
      }),
      filtering,
    );
    expect(outcome).toMatchObject({ keep: false, reason: 'language_not_allowed' });
  });

  it('keeps a Bangla post', () => {
    const outcome = decideFilter(
      basePost({ content: 'আমি বাংলায় গান গাই এবং কবিতা লিখি প্রতিদিন সকালে।' }),
      filtering,
    );
    expect(outcome).toMatchObject({ keep: true, language: 'bn' });
  });

  it('uses OCR text for language detection when the caption alone is empty', () => {
    const outcome = decideFilter(
      basePost({
        content: '',
        ocrText: 'আমরা বার্লিনে সিনিয়র ব্যাকএন্ড ইঞ্জিনিয়ার নিয়োগ করছি।',
      }),
      filtering,
    );
    expect(outcome.language).toBe('bn');
  });
});

describe('filter stage', () => {
  it('moves survivors to filtered and drops with a reason recorded', () => {
    const db = createTestDb();
    const repos: Repositories = createRepositories(db);
    const config = loadConfig();
    const run = repos.runs.create('manual');
    const logger = pino({ level: 'silent' });

    const { post: keeper } = repos.posts.insertOrTouch({
      hash: 'h1',
      authorName: 'Jane Doe',
      content: 'A real, substantive update about our incident response process this quarter.',
      firstSeenRunId: run.id,
      collectedAt: new Date(),
    });
    repos.posts.updateStatus(keeper.id, 'ocr_done');

    const { post: dropped } = repos.posts.insertOrTouch({
      hash: 'h2',
      authorName: 'Promo Bot',
      content: 'Buy now!',
      isSponsored: true,
      firstSeenRunId: run.id,
      collectedAt: new Date(),
    });
    repos.posts.updateStatus(dropped.id, 'ocr_done');

    filter.run({ db, repos, config, logger, run });

    expect(repos.posts.get(keeper.id)!.processingStatus).toBe('filtered');
    expect(repos.posts.get(keeper.id)!.language).toBe('en');

    expect(repos.posts.get(dropped.id)!.processingStatus).toBe('dropped');
    expect(repos.posts.get(dropped.id)!.dropReason).toBe('sponsored');
  });
});
