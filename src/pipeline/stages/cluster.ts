import type { Stage, StageContext } from '../types';
import type { Embedder } from '../../llm/types';
import { createEmbedder } from '../../llm';
import { newId } from '../../db/ids';
import { clusterBySimilarity, representativeMembers } from '../../services/clustering/cluster';
import { MAX_SOURCES_PER_TOPIC } from './digestLimits';

/**
 * Embeds every `enriched` post (grill H1: local embeddings via a small Ollama model,
 * `embeddinggemma`), clusters them per category (grill H1/H2 — recomputed fresh each digest,
 * so this runs once over the whole current batch rather than in the usual 25-at-a-time loop:
 * cluster membership is a collective decision, not a per-post one), and creates the digest's
 * `topicClusters`/`topicClusterPosts` rows. Every clustered post advances to `clustered`
 * regardless of whether its cluster ends up featured — the `summarize` stage caps which
 * clusters actually get an LLM-written title/bullets (grill A3: at most 5 topics per section),
 * but posts in the rest aren't stuck; they're just not named in this digest's UI.
 */
export async function runClusterStage(
  ctx: StageContext,
  createEmbedderForStage: (ctx: StageContext) => Embedder = (c) => createEmbedder(c.config),
): Promise<void> {
  const posts = ctx.repos.posts.listByStatus('enriched', 100_000);
  if (posts.length === 0) {
    ctx.logger.info({ stage: 'cluster' }, 'cluster: no enriched posts, skipping');
    return;
  }

  const embedder = createEmbedderForStage(ctx);
  let embeddings: number[][];
  try {
    const texts = posts.map((p) => `${p.content}\n${p.ocrText ?? ''}`.trim());
    embeddings = await embedder.embed(texts);
  } finally {
    await embedder.release();
  }
  const embeddingById = new Map(posts.map((p, i) => [p.id, embeddings[i]!]));

  const byCategory = new Map<string, typeof posts>();
  for (const post of posts) {
    const category = ctx.repos.postAnalysis.get(post.id)?.primaryCategory ?? 'uncategorized';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(post);
  }

  const previous = ctx.repos.digests.latest();
  const windowStart =
    previous?.windowEnd ?? new Date(Math.min(...posts.map((p) => p.collectedAt.getTime())));
  const digestId = newId();
  const now = new Date();

  ctx.db.transaction(() => {
    ctx.repos.digests.insert({
      id: digestId,
      runId: ctx.run.id,
      windowStart,
      windowEnd: now,
      createdAt: now,
      stats: {},
    });

    for (const [category, categoryPosts] of byCategory) {
      const items = categoryPosts.map((p) => ({ id: p.id, embedding: embeddingById.get(p.id)! }));
      const clusters = clusterBySimilarity(items, ctx.config.thresholds.clusterScore);

      for (const cluster of clusters) {
        const clusterId = newId();
        ctx.repos.topicClusters.insert({
          id: clusterId,
          digestId,
          category,
          title: '',
          summary: { bullets: [] },
          score: cluster.cohesion,
        });

        const reps = representativeMembers(cluster, embeddingById, MAX_SOURCES_PER_TOPIC);
        for (const postId of cluster.members) {
          const repRank = reps.indexOf(postId);
          ctx.repos.topicClusterPosts.insert({
            clusterId,
            postId,
            rank: repRank >= 0 ? repRank : MAX_SOURCES_PER_TOPIC + cluster.members.indexOf(postId),
          });
          ctx.repos.posts.updateStatus(postId, 'clustered');
        }
      }
    }
  });

  ctx.logger.info(
    { stage: 'cluster', digestId, posts: posts.length, categories: byCategory.size },
    'cluster: created digest and topic clusters',
  );
}

export const cluster: Stage = {
  name: 'cluster',
  run: (ctx) => runClusterStage(ctx),
};
