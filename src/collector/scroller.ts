import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { DigestConfig } from '../config/schema';
import type { Logger } from '../logging';
import type { PostsRepository } from '../db/repositories/posts';
import type { PostImagesRepository } from '../db/repositories/postImages';
import type { RunEventsRepository } from '../db/repositories/runEvents';
import { parsePost } from './parse/parsePost';
import { classifyUrl } from './detection';
import { checkStopCondition, type StopReason } from './stopConditions';
import { nextPauseMs, nextScrollStepPx } from './pacing';
import type { CollectorDriver } from './driver';

export type CollectStats = {
  postsSeen: number;
  postsNew: number;
  parseErrors: number;
  screenshots: number;
  elapsedMs: number;
};

export type CollectResult =
  | { outcome: 'stopped'; reason: StopReason; stats: CollectStats }
  | { outcome: 'checkpoint_timeout'; stats: CollectStats };

/** A post whose HTML didn't match the expected shape — kept for later debugging (grill C11). */
function saveSnapshot(dir: string, html: string): void {
  const id = createHash('sha256').update(html).digest('hex').slice(0, 16);
  fs.writeFileSync(path.join(dir, `${Date.now()}-${id}.html`), html, 'utf8');
}

/** Polls until the page is back on the feed or `checkpointWaitMinutes` elapses (grill B3/Q8). */
async function waitForResolution(
  driver: CollectorDriver,
  config: DigestConfig,
  now: () => Date,
): Promise<boolean> {
  const deadline = now().getTime() + config.stopConditions.checkpointWaitMinutes * 60_000;
  while (now().getTime() < deadline) {
    await driver.wait(config.stopConditions.checkpointPollSeconds * 1000);
    if (classifyUrl(driver.url()) === 'feed') return true;
  }
  return false;
}

/**
 * Drives one live collection session against `driver`: human-paced scrolling, "see more"
 * expansion (already done by `driver.extractPosts()`), dedup on insert, opportunistic
 * screenshots for OCR (slice 5), and the three stop conditions from grill C6. Posts are
 * committed to the DB as they're found, not batched — so whatever was collected before a
 * checkpoint or a stop condition is never lost, even if the session ends abnormally.
 */
export async function collectFeed(
  driver: CollectorDriver,
  deps: {
    postsRepo: PostsRepository;
    postImagesRepo: PostImagesRepository;
    runEvents: RunEventsRepository;
    runId: string;
    config: DigestConfig;
    logger: Logger;
    imagesDir: string;
    snapshotsDir: string;
    now?: () => Date;
  },
): Promise<CollectResult> {
  const { postsRepo, postImagesRepo, runEvents, runId, config, logger } = deps;
  const now = deps.now ?? (() => new Date());
  const start = now().getTime();

  fs.mkdirSync(deps.imagesDir, { recursive: true });
  fs.mkdirSync(deps.snapshotsDir, { recursive: true });

  const stats: CollectStats = {
    postsSeen: 0,
    postsNew: 0,
    parseErrors: 0,
    screenshots: 0,
    elapsedMs: 0,
  };
  let consecutiveSeen = 0;

  for (;;) {
    stats.elapsedMs = now().getTime() - start;
    const stopReason = checkStopCondition(
      { elapsedMs: stats.elapsedMs, postsCollected: stats.postsNew, consecutiveSeen },
      config.stopConditions,
    );
    if (stopReason) return { outcome: 'stopped', reason: stopReason, stats };

    const state = classifyUrl(driver.url());
    if (state !== 'feed') {
      logger.warn({ runId, state, url: driver.url() }, 'collector blocked — not on the feed');
      runEvents.log(
        runId,
        'warn',
        `blocked on page state "${state}" — waiting for you to resolve it by hand`,
        { stage: 'collect' },
      );
      const resolved = await waitForResolution(driver, config, now);
      if (!resolved) return { outcome: 'checkpoint_timeout', stats };
      runEvents.log(runId, 'info', 'checkpoint/login wall resolved — resuming collection', {
        stage: 'collect',
      });
      continue;
    }

    const extracted = await driver.extractPosts();
    for (const item of extracted) {
      const draft = parsePost(item.html, now());
      if (draft.parseError) {
        stats.parseErrors += 1;
        saveSnapshot(deps.snapshotsDir, item.html);
        continue;
      }
      stats.postsSeen += 1;

      const { post, inserted } = postsRepo.insertOrTouch({
        externalId: draft.externalId,
        hash: draft.hash,
        url: draft.url,
        authorName: draft.authorName,
        authorHeadline: draft.authorHeadline,
        viaName: draft.viaName,
        content: draft.content,
        contentType: draft.contentType,
        isSponsored: draft.isSponsored,
        isConnectionSuggestion: draft.isConnectionSuggestion,
        isPoll: draft.isPoll,
        publishedAt: draft.publishedAt,
        publishedAtPrecision: draft.publishedAtPrecision,
        firstSeenRunId: runId,
        collectedAt: now(),
      });

      if (!inserted) {
        consecutiveSeen += 1;
        continue;
      }
      consecutiveSeen = 0;
      stats.postsNew += 1;

      if (item.hasVisualMedia) {
        const filePath = path.join(deps.imagesDir, `${post.id}.png`);
        try {
          const captured = await driver.screenshotElement(item.idx, filePath);
          if (captured) {
            postImagesRepo.add(post.id, filePath);
            stats.screenshots += 1;
          }
        } catch (err) {
          logger.warn({ postId: post.id, err }, 'collect: screenshot failed');
        }
      }

      const midBatchStop = checkStopCondition(
        {
          elapsedMs: now().getTime() - start,
          postsCollected: stats.postsNew,
          consecutiveSeen,
        },
        config.stopConditions,
      );
      if (midBatchStop) return { outcome: 'stopped', reason: midBatchStop, stats };
    }

    await driver.scrollBy(nextScrollStepPx(config.pacing));
    await driver.wait(nextPauseMs(config.pacing));
  }
}
