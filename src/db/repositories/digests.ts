import { eq, desc } from 'drizzle-orm';
import type { DbClient } from '../client';
import { digests } from '../schema';

export type DigestRow = typeof digests.$inferSelect;

export type NewDigestInput = {
  id: string;
  runId: string;
  windowStart: Date;
  windowEnd: Date;
  createdAt: Date;
  stats: Record<string, unknown>;
};

export function createDigestsRepository(db: DbClient) {
  return {
    insert(input: NewDigestInput): void {
      db.insert(digests).values(input).run();
    },

    get(id: string): DigestRow | undefined {
      return db.select().from(digests).where(eq(digests.id, id)).get();
    },

    getByRunId(runId: string): DigestRow | undefined {
      return db.select().from(digests).where(eq(digests.runId, runId)).get();
    },

    /** Most recently created digest — its `windowEnd` becomes the next digest's `windowStart` (grill A4). */
    latest(): DigestRow | undefined {
      return db.select().from(digests).orderBy(desc(digests.createdAt)).limit(1).get();
    },

    list(limit = 50): DigestRow[] {
      return db.select().from(digests).orderBy(desc(digests.createdAt)).limit(limit).all();
    },

    setStats(id: string, stats: Record<string, unknown>): void {
      db.update(digests).set({ stats }).where(eq(digests.id, id)).run();
    },
  };
}

export type DigestsRepository = ReturnType<typeof createDigestsRepository>;
