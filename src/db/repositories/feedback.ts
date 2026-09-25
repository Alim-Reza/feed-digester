import { eq } from 'drizzle-orm';
import type { DbClient } from '../client';
import { newId } from '../ids';
import { feedback, type FeedbackKind } from '../schema';

export type FeedbackRow = typeof feedback.$inferSelect;

export type NewFeedbackInput = {
  postId: string;
  kind: FeedbackKind;
  value?: unknown;
};

export function createFeedbackRepository(db: DbClient) {
  return {
    /** Called by `web` only, same as `runCommands.enqueue` — 👍/👎, wrong-category, and ground-truth labels (grill D6/E5). */
    add(input: NewFeedbackInput): void {
      db.insert(feedback)
        .values({
          id: newId(),
          postId: input.postId,
          kind: input.kind,
          value: input.value ?? null,
          createdAt: new Date(),
        })
        .run();
    },

    listForPost(postId: string): FeedbackRow[] {
      return db.select().from(feedback).where(eq(feedback.postId, postId)).all();
    },

    /** For the ADR 0003 bake-off eval script: every ground-truth label collected in `/posts`. */
    listByKind(kind: FeedbackKind, limit = 1000): FeedbackRow[] {
      return db.select().from(feedback).where(eq(feedback.kind, kind)).limit(limit).all();
    },
  };
}

export type FeedbackRepository = ReturnType<typeof createFeedbackRepository>;
