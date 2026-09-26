import type { Stage, StageContext } from '../types';
import { aggregateJobMarket, buildJobOpeningViews } from '../../services/jobs/aggregate';
import { estimateReadingMinutes, rankInsights, type RankableInsight } from '../../services/ranking/rankInsights';
import { newId } from '../../db/ids';

/**
 * Finalizes the digest `cluster` created this run (spec-second.md §7): ranks every surviving
 * insight across ALL categories (not per-section — category is metadata, not a container),
 * assigns the final `rank` to the top `briefing.maxInsights`, advances every post that ended up
 * in one of this digest's clusters to `digested`, and writes the finite-briefing metadata
 * (posts scanned/useful/filtered-as-noise/merged, estimated reading time) plus the Job Market
 * aggregates, scoped to this digest window only (grill G6). `digest_sections` rows are still
 * written for the existing read path (`digestView.ts`) but with deterministic post counts only —
 * no LLM call here anymore (that lived in `summarize.ts` and is gone, per the redesign).
 */
export async function runDigestStage(ctx: StageContext): Promise<void> {
  const digestRow = ctx.repos.digests.getByRunId(ctx.run.id);
  if (!digestRow) {
    ctx.logger.info({ stage: 'digest' }, 'digest: no digest for this run, skipping');
    return;
  }

  const clusters = ctx.repos.topicClusters.listForDigest(digestRow.id);
  const membersByCluster = new Map(
    clusters.map((c) => [c.id, ctx.repos.topicClusterPosts.listForCluster(c.id)]),
  );
  const memberCount = (clusterId: string) => membersByCluster.get(clusterId)?.length ?? 0;

  const insightClusters = clusters.filter((c) => c.title !== '');
  const rankable: RankableInsight[] = insightClusters.map((c) => ({
    id: c.id,
    category: c.category,
    title: c.title,
    summary: c.summary,
    cohesion: c.score,
    sourceCount: memberCount(c.id),
    noveltyLevel: c.noveltyLevel ?? 'low',
  }));
  const profileKeywords = [...ctx.config.profile.interests, ...ctx.config.profile.goals];
  const ranked = rankInsights(rankable, {
    weights: ctx.config.briefing.weights,
    categoryRelevanceWeights: ctx.config.classification.relevanceWeights,
    profileKeywords,
    maxInsights: ctx.config.briefing.maxInsights,
  });
  const rankById = new Map(ranked.map((r) => [r.id, r.rank]));

  const postIds = ctx.repos.topicClusterPosts.listPostIdsForDigest(digestRow.id);
  const jobRows = postIds.flatMap((id) => ctx.repos.jobOpenings.listForPost(id));
  const sourceByPostId = new Map(
    postIds.map((id) => {
      const post = ctx.repos.posts.get(id);
      return [id, { url: post?.url ?? null, authorName: post?.authorName ?? 'Unknown' }];
    }),
  );

  const postCountByCategory = new Map<string, number>();
  for (const cluster of clusters) {
    postCountByCategory.set(
      cluster.category,
      (postCountByCategory.get(cluster.category) ?? 0) + memberCount(cluster.id),
    );
  }
  const sections = [...postCountByCategory.entries()].map(([category, postCount]) => ({
    category,
    postCount,
    tldr: `${postCount} post${postCount === 1 ? '' : 's'} this cycle.`,
    order: (() => {
      const idx = ctx.config.categories.findIndex((c) => c.id === category);
      return idx >= 0 ? idx : ctx.config.categories.length;
    })(),
  }));

  const postsUseful = insightClusters.reduce((acc, c) => acc + memberCount(c.id), 0);
  const postsFilteredNoise = clusters
    .filter((c) => c.title === '')
    .reduce((acc, c) => acc + memberCount(c.id), 0);
  const duplicatesMerged = insightClusters.reduce(
    (acc, c) => acc + Math.max(0, memberCount(c.id) - 1),
    0,
  );

  const stats = {
    totalPosts: postIds.length,
    postsScanned: postIds.length,
    postsUseful,
    postsFilteredNoise,
    duplicatesMerged,
    featuredInsights: ranked.length,
    estimatedReadingMinutes: estimateReadingMinutes(ranked.length),
    sections: sections.map(({ category, postCount, tldr }) => ({ category, postCount, tldr })),
    jobMarket: {
      ...aggregateJobMarket(jobRows),
      openings: buildJobOpeningViews(jobRows, sourceByPostId, ctx.config.profile),
    },
  };

  ctx.db.transaction(() => {
    for (const postId of postIds) ctx.repos.posts.updateStatus(postId, 'digested');
    for (const cluster of insightClusters) {
      ctx.repos.topicClusters.setRank(cluster.id, rankById.get(cluster.id) ?? null);
    }
    for (const section of sections) {
      ctx.repos.digestSections.insert({
        id: newId(),
        digestId: digestRow.id,
        category: section.category,
        tldr: section.tldr,
        postCount: section.postCount,
        order: section.order,
      });
    }
    ctx.repos.digests.setStats(digestRow.id, stats);
  });

  ctx.logger.info(
    { stage: 'digest', digestId: digestRow.id, posts: postIds.length, featured: ranked.length },
    'digest: finalized',
  );
}

export const digest: Stage = {
  name: 'digest',
  run: runDigestStage,
};
