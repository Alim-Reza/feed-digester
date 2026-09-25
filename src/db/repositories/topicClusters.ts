import { eq } from 'drizzle-orm';
import type { DbClient } from '../client';
import { topicClusters } from '../schema';

export type TopicClusterRow = typeof topicClusters.$inferSelect;
export type ClusterSummaryValue = TopicClusterRow['summary'];

export type NewTopicClusterInput = {
  id: string;
  digestId: string;
  category: string;
  title: string;
  summary: ClusterSummaryValue;
  score: number;
};

export function createTopicClustersRepository(db: DbClient) {
  return {
    insert(input: NewTopicClusterInput): void {
      db.insert(topicClusters).values(input).run();
    },

    listForDigest(digestId: string): TopicClusterRow[] {
      return db.select().from(topicClusters).where(eq(topicClusters.digestId, digestId)).all();
    },

    /** Filled in by the `summarize` stage once the LLM call for this topic succeeds. */
    updateSummary(id: string, title: string, summary: ClusterSummaryValue): void {
      db.update(topicClusters).set({ title, summary }).where(eq(topicClusters.id, id)).run();
    },
  };
}

export type TopicClustersRepository = ReturnType<typeof createTopicClustersRepository>;
