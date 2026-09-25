import { eq } from 'drizzle-orm';
import type { DbClient } from '../client';
import { newId } from '../ids';
import { jobOpenings } from '../schema';

export type JobOpeningRow = typeof jobOpenings.$inferSelect;

export type NewJobOpeningInput = {
  postId: string;
  company: string | null;
  role: string;
  location: string | null;
  remoteStatus: string | null;
  seniority: string | null;
  experience: string | null;
  skills: string[];
  model: string;
};

export function createJobOpeningsRepository(db: DbClient) {
  return {
    /** One row per role (grill G3) — a post with several open roles gets several rows. */
    insert(input: NewJobOpeningInput): void {
      db.insert(jobOpenings)
        .values({ id: newId(), ...input })
        .run();
    },

    listForPost(postId: string): JobOpeningRow[] {
      return db.select().from(jobOpenings).where(eq(jobOpenings.postId, postId)).all();
    },

    /** For the Job Market section's aggregates (slice 9/10) — current digest window only (grill G6). */
    list(limit = 500): JobOpeningRow[] {
      return db.select().from(jobOpenings).limit(limit).all();
    },
  };
}

export type JobOpeningsRepository = ReturnType<typeof createJobOpeningsRepository>;
