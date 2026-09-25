import { eq } from 'drizzle-orm';
import type { DbClient } from '../client';
import { postAnalysis } from '../schema';

export type PostAnalysisRow = typeof postAnalysis.$inferSelect;

export type UpsertPostAnalysisInput = {
  postId: string;
  categories: Record<string, number>;
  primaryCategory: string;
  relevance: number;
  classifier: string;
  model: string;
  processedAt: Date;
};

export function createPostAnalysisRepository(db: DbClient) {
  return {
    /** One row per post — a re-classification (e.g. after switching `classification.active`) replaces it. */
    upsert(input: UpsertPostAnalysisInput): void {
      db.insert(postAnalysis)
        .values(input)
        .onConflictDoUpdate({
          target: postAnalysis.postId,
          set: {
            categories: input.categories,
            primaryCategory: input.primaryCategory,
            relevance: input.relevance,
            classifier: input.classifier,
            model: input.model,
            processedAt: input.processedAt,
          },
        })
        .run();
    },

    get(postId: string): PostAnalysisRow | undefined {
      return db.select().from(postAnalysis).where(eq(postAnalysis.postId, postId)).get();
    },
  };
}

export type PostAnalysisRepository = ReturnType<typeof createPostAnalysisRepository>;
