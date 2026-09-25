import fs from 'node:fs';
import path from 'node:path';
import type { Stage, StageContext } from '../types';
import { runBatchLoop } from '../batch';

const PURGE_BATCH_SIZE = 500;

/**
 * The cutoff timestamp for purging: the `finishedAt` of the Nth-most-recent `succeeded` run
 * (`retention.keepCompletedRuns`). `null` until that many runs have ever succeeded — grill Q7(a)
 * ("a cycle is a completed run"), so nothing purges before N full cycles have actually happened.
 */
export function retentionCutoff(ctx: StageContext): Date | null {
  const keep = ctx.config.retention.keepCompletedRuns;
  const recent = ctx.repos.runs.listRecentSucceeded(keep);
  if (recent.length < keep) return null;
  return recent[recent.length - 1]!.finishedAt!;
}

/** Snapshot files are named `<Date.now()>-<hash>.html` (`collector/scroller.ts`) — no DB row to join against, so the cutoff is read straight from the filename. */
export function isSnapshotExpired(filename: string, cutoff: Date): boolean {
  const match = /^(\d+)-/.exec(filename);
  if (!match) return false;
  const ts = Number(match[1]);
  return Number.isFinite(ts) && ts < cutoff.getTime();
}

function purgePostContent(ctx: StageContext, cutoff: Date): number {
  const { items } = runBatchLoop(ctx.db, {
    batchSize: PURGE_BATCH_SIZE,
    selectBatch: (limit) => ctx.repos.posts.listPurgeCandidates(cutoff, limit),
    processBatch: (batch) => {
      const now = new Date();
      for (const post of batch) {
        for (const image of ctx.repos.postImages.listForPost(post.id)) {
          try {
            fs.unlinkSync(image.path);
          } catch {
            // already gone — best-effort
          }
        }
        ctx.repos.postImages.deleteForPost(post.id);
        ctx.repos.posts.purgeContent(post.id, now);
      }
    },
  });
  return items;
}

function purgeSnapshots(ctx: StageContext, cutoff: Date): number {
  const snapshotsDir = path.join(ctx.config.dataDir, 'snapshots');
  let files: string[];
  try {
    files = fs.readdirSync(snapshotsDir);
  } catch {
    return 0; // no snapshots directory yet — nothing to purge
  }
  let purged = 0;
  for (const file of files) {
    if (!isSnapshotExpired(file, cutoff)) continue;
    try {
      fs.unlinkSync(path.join(snapshotsDir, file));
      purged += 1;
    } catch {
      // already gone — best-effort
    }
  }
  return purged;
}

/**
 * Purges raw content older than `retention.keepCompletedRuns` completed cycles (grill B4/Q7):
 * post text, OCR text, and post images are deleted (files and rows). URL, author, categories/
 * scores, job rows, and digest summaries are kept, so old digests' citations still link back to
 * the original LinkedIn posts (grill Q7(c)).
 */
export const retention: Stage = {
  name: 'retention',
  run(ctx: StageContext) {
    const cutoff = retentionCutoff(ctx);
    if (!cutoff) {
      ctx.logger.info(
        { stage: 'retention', keepCompletedRuns: ctx.config.retention.keepCompletedRuns },
        'retention: fewer than keepCompletedRuns runs have succeeded so far, nothing to purge',
      );
      return;
    }
    const purgedPosts = purgePostContent(ctx, cutoff);
    const purgedSnapshots = purgeSnapshots(ctx, cutoff);
    ctx.logger.info(
      { stage: 'retention', cutoff, purgedPosts, purgedSnapshots },
      'retention: purged raw content older than the retention window',
    );
  },
};
