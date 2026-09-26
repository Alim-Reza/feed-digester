import { eq } from 'drizzle-orm';
import type { DbClient } from '../client';
import { topicClusters, type InsightLevel } from '../schema';

export type TopicClusterRow = typeof topicClusters.$inferSelect;

export type NewTopicClusterInput = {
  id: string;
  digestId: string;
  category: string;
  title: string;
  summary: string;
  score: number;
};

export type InsightUpdateInput = {
  title: string;
  summary: string;
  whyItMatters: string;
  suggestedAction: string | null;
  noveltyLevel: InsightLevel;
  confidence: InsightLevel;
};

export function createTopicClustersRepository(db: DbClient) {
  return {
    insert(input: NewTopicClusterInput): void {
      db.insert(topicClusters).values(input).run();
    },

    listForDigest(digestId: string): TopicClusterRow[] {
      return db.select().from(topicClusters).where(eq(topicClusters.digestId, digestId)).all();
    },

    /** Filled in by the `summarize` stage once it judges a cluster to actually be an insight. */
    updateInsight(id: string, input: InsightUpdateInput): void {
      db.update(topicClusters).set(input).where(eq(topicClusters.id, id)).run();
    },

    /** Filled in by the `digest` stage's deterministic cross-category ranking; null = not featured. */
    setRank(id: string, rank: number | null): void {
      db.update(topicClusters).set({ rank }).where(eq(topicClusters.id, id)).run();
    },
  };
}

export type TopicClustersRepository = ReturnType<typeof createTopicClustersRepository>;
