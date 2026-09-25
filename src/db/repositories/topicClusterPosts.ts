import { eq, asc } from 'drizzle-orm';
import type { DbClient } from '../client';
import { topicClusterPosts, topicClusters } from '../schema';

export type TopicClusterPostRow = typeof topicClusterPosts.$inferSelect;

export function createTopicClusterPostsRepository(db: DbClient) {
  return {
    insert(input: { clusterId: string; postId: string; rank: number }): void {
      db.insert(topicClusterPosts).values(input).run();
    },

    /** Ordered by `rank` ascending — the cluster stage ranks representative (citable) members first. */
    listForCluster(clusterId: string): TopicClusterPostRow[] {
      return db
        .select()
        .from(topicClusterPosts)
        .where(eq(topicClusterPosts.clusterId, clusterId))
        .orderBy(asc(topicClusterPosts.rank))
        .all();
    },

    /** Every post belonging to any cluster of `digestId` — what the `digest` stage advances to `digested`. */
    listPostIdsForDigest(digestId: string): string[] {
      const rows = db
        .select({ postId: topicClusterPosts.postId })
        .from(topicClusterPosts)
        .innerJoin(topicClusters, eq(topicClusterPosts.clusterId, topicClusters.id))
        .where(eq(topicClusters.digestId, digestId))
        .all();
      return rows.map((r) => r.postId);
    },
  };
}

export type TopicClusterPostsRepository = ReturnType<typeof createTopicClusterPostsRepository>;
