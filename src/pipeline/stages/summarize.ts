import type { Stage, StageContext } from '../types';
import { createLLMProvider } from '../../llm';
import { createSummarizer, type Summarizer } from '../../services/summarization/summarizer';
import type { SourcePost } from '../../services/summarization/types';
import { newId } from '../../db/ids';
import type { TopicClusterRow } from '../../db/repositories/topicClusters';
import { MAX_SOURCES_PER_TOPIC, MAX_TOPICS_PER_SECTION } from './digestLimits';

function categoryLabelFor(ctx: StageContext, category: string): string {
  return ctx.config.categories.find((c) => c.id === category)?.label ?? category;
}

/**
 * Writes each topic cluster's LLM title/bullets and each category's TL;DR (grill H3) for the
 * digest `cluster` created this run. Doesn't move post status (that's `digest`'s job) — a
 * cluster or section whose LLM call fails is logged and left with a fallback instead of failing
 * the whole run, since this digest cycle is one-shot anyway (grill H2: recomputed fresh next
 * time, nothing to retry across runs).
 */
export async function runSummarizeStage(
  ctx: StageContext,
  createSummarizerForStage: (ctx: StageContext) => Summarizer = (c) =>
    createSummarizer({ llm: createLLMProvider(c.config, c.logger) }),
): Promise<void> {
  const digestRow = ctx.repos.digests.getByRunId(ctx.run.id);
  if (!digestRow) {
    ctx.logger.info({ stage: 'summarize' }, 'summarize: no digest for this run, skipping');
    return;
  }

  const clusters = ctx.repos.topicClusters.listForDigest(digestRow.id);
  const byCategory = new Map<string, TopicClusterRow[]>();
  for (const c of clusters) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category)!.push(c);
  }

  const summarizer = createSummarizerForStage(ctx);
  let summarized = 0;
  let failed = 0;
  try {
    for (const [category, categoryClusters] of byCategory) {
      const categoryLabel = categoryLabelFor(ctx, category);
      const sized = categoryClusters.map((c) => ({
        cluster: c,
        members: ctx.repos.topicClusterPosts.listForCluster(c.id),
      }));
      const postCount = sized.reduce((acc, s) => acc + s.members.length, 0);
      const featured = [...sized]
        .sort((a, b) => b.members.length - a.members.length || b.cluster.score - a.cluster.score)
        .slice(0, MAX_TOPICS_PER_SECTION);

      const featuredTitles: string[] = [];
      for (const { cluster, members } of featured) {
        const sourcePosts: SourcePost[] = members.slice(0, MAX_SOURCES_PER_TOPIC).map((m) => {
          const post = ctx.repos.posts.get(m.postId)!;
          return { authorName: post.authorName, content: post.content, url: post.url };
        });
        try {
          const summary = await summarizer.summarizeCluster(categoryLabel, sourcePosts);
          ctx.repos.topicClusters.updateSummary(cluster.id, summary.title, {
            bullets: summary.bullets,
          });
          featuredTitles.push(summary.title);
          summarized += 1;
        } catch (err) {
          ctx.logger.warn(
            { stage: 'summarize', clusterId: cluster.id, err },
            'summarize: cluster summary failed, leaving it unfeatured',
          );
          failed += 1;
        }
      }

      let tldr: string;
      try {
        tldr =
          featuredTitles.length > 0
            ? await summarizer.summarizeSection(categoryLabel, featuredTitles)
            : `${postCount} ${categoryLabel} post${postCount === 1 ? '' : 's'} this cycle.`;
      } catch (err) {
        ctx.logger.warn({ stage: 'summarize', category, err }, 'summarize: section TL;DR failed, using a fallback');
        tldr = `${postCount} ${categoryLabel} post${postCount === 1 ? '' : 's'} this cycle.`;
      }

      const order = ctx.config.categories.findIndex((c) => c.id === category);
      ctx.repos.digestSections.insert({
        id: newId(),
        digestId: digestRow.id,
        category,
        tldr,
        postCount,
        order: order >= 0 ? order : ctx.config.categories.length,
      });
    }
  } finally {
    await summarizer.release();
  }

  ctx.logger.info({ stage: 'summarize', digestId: digestRow.id, summarized, failed }, 'summarize: wrote digest sections');
}

export const summarize: Stage = {
  name: 'summarize',
  run: (ctx) => runSummarizeStage(ctx),
};
