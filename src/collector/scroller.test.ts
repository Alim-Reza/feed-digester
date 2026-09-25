import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/testHelpers';
import { createRepositories, type Repositories } from '../db/repositories';
import { loadConfig } from '../config';
import { collectFeed } from './scroller';
import type { CollectorDriver } from './driver';
import type { ExtractedPost } from './extractSnippet';

const logger = pino({ level: 'silent' });
const FEED_URL = 'https://www.linkedin.com/feed/';
const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'linkedin');
const textBasicHtml = fs.readFileSync(path.join(FIXTURES_DIR, 'text-basic.html'), 'utf8');

function makeClock(startMs = 0) {
  let ms = startMs;
  return { now: () => new Date(ms), advance: (delta: number) => (ms += delta) };
}

/** A fake driver whose `url()` and `extractPosts()` behavior are fully controlled by the test. */
function makeFakeDriver(opts: {
  urlAt?: (tick: number) => string;
  postsAt?: (tick: number) => ExtractedPost[];
  onWait?: (ms: number) => void;
}): CollectorDriver & { screenshotCalls: { idx: number; filePath: string }[] } {
  let tick = -1;
  const screenshotCalls: { idx: number; filePath: string }[] = [];
  return {
    url: () => (opts.urlAt ? opts.urlAt(Math.max(tick, 0)) : FEED_URL),
    extractPosts: async () => {
      tick += 1;
      return opts.postsAt ? opts.postsAt(tick) : [];
    },
    screenshotElement: async (idx, filePath) => {
      screenshotCalls.push({ idx, filePath });
      return true;
    },
    scrollBy: async () => {},
    wait: async (ms) => opts.onWait?.(ms),
    screenshotCalls,
  };
}

let tmpDir: string;
let repos: Repositories;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-collect-'));
  repos = createRepositories(createTestDb());
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeDeps(
  runId: string,
  overrides: Parameters<typeof loadConfig>[0] = {},
  now?: () => Date,
) {
  return {
    postsRepo: repos.posts,
    postImagesRepo: repos.postImages,
    runEvents: repos.runEvents,
    runId,
    config: loadConfig(overrides),
    logger,
    imagesDir: path.join(tmpDir, 'images'),
    snapshotsDir: path.join(tmpDir, 'snapshots'),
    now,
  };
}

const post = (idx: number, hasVisualMedia = false): ExtractedPost => ({
  idx,
  html: textBasicHtml,
  inViewport: true,
  hasVisualMedia,
});

describe('collectFeed', () => {
  it('stops at maxPosts once enough new posts are collected', async () => {
    const driver = makeFakeDriver({ postsAt: () => [post(0)] });
    const deps = makeDeps('r1', { stopConditions: { maxPosts: 1 } });

    const result = await collectFeed(driver, deps);

    expect(result.outcome).toBe('stopped');
    expect(result).toMatchObject({ reason: 'max_posts' });
    expect(result.stats.postsNew).toBe(1);
  });

  it('dedupes a repeated post and stops after too many already-seen in a row', async () => {
    const driver = makeFakeDriver({ postsAt: () => [post(0)] });
    const deps = makeDeps('r1', {
      stopConditions: { maxPosts: 100, maxConsecutiveSeenPosts: 3 },
    });

    const result = await collectFeed(driver, deps);

    expect(result.outcome).toBe('stopped');
    expect(result).toMatchObject({ reason: 'max_consecutive_seen' });
    // First tick inserts it (new); the next 3 ticks see the same post again.
    expect(result.stats.postsNew).toBe(1);
    expect(repos.posts.countByStatus('new')).toBe(1);
  });

  it('stops at max duration using an injected clock', async () => {
    const clock = makeClock();
    const driver = makeFakeDriver({ postsAt: () => [] });
    const deps = makeDeps('r1', { stopConditions: { maxDurationMinutes: 1 } }, () => {
      clock.advance(30_000);
      return clock.now();
    });

    const result = await collectFeed(driver, deps);

    expect(result.outcome).toBe('stopped');
    expect(result).toMatchObject({ reason: 'max_duration' });
  });

  it('captures a screenshot for a post flagged with visual media', async () => {
    const driver = makeFakeDriver({ postsAt: () => [post(0, true)] });
    const deps = makeDeps('r1', { stopConditions: { maxPosts: 1 } });

    const result = await collectFeed(driver, deps);

    expect(result.stats.screenshots).toBe(1);
    expect(driver.screenshotCalls).toHaveLength(1);
    const postRow = repos.posts.listByStatus('new', 10)[0];
    expect(repos.postImages.listForPost(postRow.id)).toHaveLength(1);
  });

  it('saves an HTML snapshot and does not insert a post on a parse failure', async () => {
    const clock = makeClock();
    const driver = makeFakeDriver({
      postsAt: () => [
        {
          idx: 0,
          html: '<div>no matching selectors here</div>',
          inViewport: true,
          hasVisualMedia: false,
        },
      ],
      // A large advance per pacing wait ends the (otherwise endless, since nothing here ever
      // becomes "new" or "seen") loop via the duration stop condition after one tick.
      onWait: () => clock.advance(65_000),
    });
    const deps = makeDeps('r1', { stopConditions: { maxDurationMinutes: 1 } }, clock.now);

    const result = await collectFeed(driver, deps);

    expect(result.outcome).toBe('stopped');
    expect(result).toMatchObject({ reason: 'max_duration' });
    expect(result.stats.parseErrors).toBe(1);
    expect(result.stats.postsNew).toBe(0);
    const snapshotFiles = fs.readdirSync(path.join(tmpDir, 'snapshots'));
    expect(snapshotFiles).toHaveLength(1);
  });

  it('waits out a checkpoint and resumes collection once resolved', async () => {
    const clock = makeClock();
    const run = repos.runs.create('manual');
    let urlCalls = 0;
    const driver = makeFakeDriver({
      urlAt: () => {
        urlCalls += 1;
        return urlCalls <= 2 ? 'https://www.linkedin.com/checkpoint/challenge/' : FEED_URL;
      },
      postsAt: () => [post(0)],
      onWait: (ms) => clock.advance(ms),
    });
    const deps = makeDeps(
      run.id,
      {
        stopConditions: {
          maxPosts: 1,
          checkpointWaitMinutes: 5,
          checkpointPollSeconds: 1,
        },
      },
      clock.now,
    );

    const result = await collectFeed(driver, deps);

    expect(result.outcome).toBe('stopped');
    expect(result).toMatchObject({ reason: 'max_posts' });
    expect(result.stats.postsNew).toBe(1);
  });

  it('gives up and returns checkpoint_timeout when the wait window elapses unresolved', async () => {
    const clock = makeClock();
    const run = repos.runs.create('manual');
    const driver = makeFakeDriver({
      urlAt: () => 'https://www.linkedin.com/checkpoint/challenge/',
      onWait: (ms) => clock.advance(ms),
    });
    const deps = makeDeps(
      run.id,
      { stopConditions: { checkpointWaitMinutes: 1, checkpointPollSeconds: 1 } },
      clock.now,
    );

    const result = await collectFeed(driver, deps);

    expect(result.outcome).toBe('checkpoint_timeout');
  });
});
