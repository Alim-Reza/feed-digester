import { eq, asc } from 'drizzle-orm';
import type { DbClient } from '../client';
import { digestSections } from '../schema';

export type DigestSectionRow = typeof digestSections.$inferSelect;

export type NewDigestSectionInput = {
  id: string;
  digestId: string;
  category: string;
  tldr: string;
  postCount: number;
  order: number;
};

export function createDigestSectionsRepository(db: DbClient) {
  return {
    insert(input: NewDigestSectionInput): void {
      db.insert(digestSections).values(input).run();
    },

    listForDigest(digestId: string): DigestSectionRow[] {
      return db
        .select()
        .from(digestSections)
        .where(eq(digestSections.digestId, digestId))
        .orderBy(asc(digestSections.order))
        .all();
    },
  };
}

export type DigestSectionsRepository = ReturnType<typeof createDigestSectionsRepository>;
