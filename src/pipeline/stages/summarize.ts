import type { Stage, StageContext } from '../types';
import { createLLMProvider } from '../../llm';
import { createSummarizer, type Summarizer } from '../../services/summarization/summarizer';
import type { SourcePost } from '../../services/summarization/types';
import { categoryLabelFor } from './categoryLabel';
import { MAX_SOURCES_PER_TOPIC } from './digestLimits';

/**
 * Evaluates every topic cluster `cluster` created this run (spec-second.md §§2-5: novelty,
 * dedup-by-clustering already done, now judge usefulness and extract a concrete claim) and, for
 * the ones judged a real insight, writes the synthesized claim onto the cluster row. Clusters
 * judged generic/low-value are left untouched (empty title = "not an insight" — same convention
 * as the old "unfeatured" state, just driven by a judgment now instead of a top-5-per-category
 * cap). No per-category LLM TL;DR anymore — that second call was the other half of the
 * genericness problem this redesign fixes; `digest` ranks surviving insights across every
 * category next. Doesn't move post status (that's `digest`'s job) — a cluster whose LLM call
 * fails is logged and left unfeatured instead of failing the whole run, since this digest cycle
 * is one-shot anyway (grill H2: recomputed fresh next time).
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
  const summarizer = createSummarizerForStage(ctx);
  const profile = ctx.config.profile;
  let insights = 0;
  let noise = 0;
  let failed = 0;

  try {
    for (const cluster of clusters) {
      const members = ctx.repos.topicClusterPosts.listForCluster(cluster.id);
      const sourcePosts: SourcePost[] = members.slice(0, MAX_SOURCES_PER_TOPIC).map((m) => {
        const post = ctx.repos.posts.get(m.postId)!;
        return { authorName: post.authorName, content: post.content, url: post.url };
      });
      const categoryLabel = categoryLabelFor(ctx.config, cluster.category);
      try {
        const evaluation = await summarizer.evaluateCluster(categoryLabel, sourcePosts, profile);
        if (evaluation.isInsight) {
          ctx.repos.topicClusters.updateInsight(cluster.id, {
            title: evaluation.title,
            summary: evaluation.summary,
            whyItMatters: evaluation.whyItMatters,
            suggestedAction: evaluation.suggestedAction,
            noveltyLevel: evaluation.noveltyLevel,
            confidence: evaluation.confidence,
          });
          insights += 1;
        } else {
          noise += 1;
        }
      } catch (err) {
        ctx.logger.warn(
          { stage: 'summarize', clusterId: cluster.id, err },
          'summarize: insight evaluation failed, leaving it unfeatured',
        );
        failed += 1;
      }
    }
  } finally {
    await summarizer.release();
  }

  ctx.logger.info(
    { stage: 'summarize', digestId: digestRow.id, insights, noise, failed },
    'summarize: evaluated topic clusters',
  );
}

export const summarize: Stage = {
  name: 'summarize',
  run: (ctx) => runSummarizeStage(ctx),
};
