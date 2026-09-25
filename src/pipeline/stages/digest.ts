import type { Stage, StageContext } from '../types';
import { aggregateJobMarket } from '../../services/jobs/aggregate';

/**
 * Finalizes the digest `cluster` created this run: advances every post that ended up in one of
 * its topic clusters to `digested`, and writes the digest's `stats` (per-section post counts
 * plus the Job Market aggregates from spec — companies hiring, roles, skills, seniority,
 * location/remote patterns — scoped to this digest window only, grill G6).
 */
export async function runDigestStage(ctx: StageContext): Promise<void> {
  const digestRow = ctx.repos.digests.getByRunId(ctx.run.id);
  if (!digestRow) {
    ctx.logger.info({ stage: 'digest' }, 'digest: no digest for this run, skipping');
    return;
  }

  const postIds = ctx.repos.topicClusterPosts.listPostIdsForDigest(digestRow.id);
  const jobRows = postIds.flatMap((id) => ctx.repos.jobOpenings.listForPost(id));
  const sections = ctx.repos.digestSections.listForDigest(digestRow.id);

  const stats = {
    totalPosts: postIds.length,
    sections: sections.map((s) => ({ category: s.category, postCount: s.postCount, tldr: s.tldr })),
    jobMarket: aggregateJobMarket(jobRows),
  };

  ctx.db.transaction(() => {
    for (const postId of postIds) ctx.repos.posts.updateStatus(postId, 'digested');
    ctx.repos.digests.setStats(digestRow.id, stats);
  });

  ctx.logger.info(
    { stage: 'digest', digestId: digestRow.id, posts: postIds.length },
    'digest: finalized',
  );
}

export const digest: Stage = {
  name: 'digest',
  run: runDigestStage,
};
