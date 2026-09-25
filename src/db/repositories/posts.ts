import { eq, and, or, like, desc, lt, isNull, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { newId } from '../ids';
import {
  posts,
  type PostContentType,
  type PostProcessingStatus,
  type PublishedAtPrecision,
} from '../schema';

export type NewPostInput = {
  externalId?: string | null;
  hash: string;
  url?: string | null;
  authorName: string;
  authorHeadline?: string | null;
  viaName?: string | null;
  content?: string;
  contentType?: PostContentType;
  language?: string | null;
  isSponsored?: boolean;
  isConnectionSuggestion?: boolean;
  isPoll?: boolean;
  publishedAt?: Date | null;
  publishedAtPrecision?: PublishedAtPrecision | null;
  firstSeenRunId: string;
  collectedAt: Date;
};

export type PostRow = typeof posts.$inferSelect;

export function createPostsRepository(db: DbClient) {
  return {
    /**
     * Inserts a post, or touches `lastSeenAt` on an existing one matched by
     * `externalId` (preferred) or `hash`. Runs in one transaction so the
     * dedup check-then-act is atomic. See plan §3.4 (repost dedup).
     */
    insertOrTouch(input: NewPostInput): { post: PostRow; inserted: boolean } {
      return db.transaction((tx) => {
        const existing = input.externalId
          ? tx.select().from(posts).where(eq(posts.externalId, input.externalId)).get()
          : tx.select().from(posts).where(eq(posts.hash, input.hash)).get();

        if (existing) {
          tx.update(posts)
            .set({ lastSeenAt: input.collectedAt })
            .where(eq(posts.id, existing.id))
            .run();
          return { post: { ...existing, lastSeenAt: input.collectedAt }, inserted: false };
        }

        const row = {
          id: newId(),
          externalId: input.externalId ?? null,
          hash: input.hash,
          url: input.url ?? null,
          authorName: input.authorName,
          authorHeadline: input.authorHeadline ?? null,
          viaName: input.viaName ?? null,
          content: input.content ?? '',
          contentType: input.contentType ?? 'text',
          language: input.language ?? null,
          isSponsored: input.isSponsored ?? false,
          isConnectionSuggestion: input.isConnectionSuggestion ?? false,
          isPoll: input.isPoll ?? false,
          publishedAt: input.publishedAt ?? null,
          publishedAtPrecision: input.publishedAtPrecision ?? null,
          firstSeenRunId: input.firstSeenRunId,
          lastSeenAt: input.collectedAt,
          collectedAt: input.collectedAt,
          processingStatus: 'new' as const,
          attempts: 0,
        };
        tx.insert(posts).values(row).run();
        const inserted = tx.select().from(posts).where(eq(posts.id, row.id)).get()!;
        return { post: inserted, inserted: true };
      });
    },

    listByStatus(status: PostProcessingStatus, limit: number): PostRow[] {
      return db.select().from(posts).where(eq(posts.processingStatus, status)).limit(limit).all();
    },

    countByStatus(status: PostProcessingStatus): number {
      const row = db
        .select({ count: sql<number>`count(*)` })
        .from(posts)
        .where(eq(posts.processingStatus, status))
        .get();
      return row?.count ?? 0;
    },

    get(id: string): PostRow | undefined {
      return db.select().from(posts).where(eq(posts.id, id)).get();
    },

    /** Moves a post to a new status and applies any other column changes, in one write. */
    updateStatus(id: string, status: PostProcessingStatus, patch: Partial<PostRow> = {}): void {
      db.update(posts)
        .set({ ...patch, processingStatus: status })
        .where(eq(posts.id, id))
        .run();
    },

    drop(id: string, reason: string): void {
      db.update(posts)
        .set({ processingStatus: 'dropped', dropReason: reason })
        .where(eq(posts.id, id))
        .run();
    },

    /** Records a failed processing attempt; marks the post `failed` once attempts reach maxAttempts. */
    recordAttemptFailure(id: string, error: string, maxAttempts = 3): PostRow {
      return db.transaction((tx) => {
        const current = tx.select().from(posts).where(eq(posts.id, id)).get();
        if (!current) throw new Error(`post ${id} not found`);
        const attempts = current.attempts + 1;
        const status = attempts >= maxAttempts ? ('failed' as const) : current.processingStatus;
        tx.update(posts)
          .set({ attempts, lastError: error, processingStatus: status })
          .where(eq(posts.id, id))
          .run();
        return { ...current, attempts, lastError: error, processingStatus: status };
      });
    },

    /** For the `/posts` browser (grill I3): any status, optionally filtered, newest-collected first. */
    list(opts: { status?: PostProcessingStatus; q?: string; limit?: number } = {}): PostRow[] {
      const conditions = [
        opts.status ? eq(posts.processingStatus, opts.status) : undefined,
        opts.q ? or(like(posts.authorName, `%${opts.q}%`), like(posts.content, `%${opts.q}%`)) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);

      return db
        .select()
        .from(posts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(posts.collectedAt))
        .limit(opts.limit ?? 50)
        .all();
    },

    /** Not-yet-purged posts collected before `cutoff` — the `retention` stage's batch source (grill B4/Q7). */
    listPurgeCandidates(cutoff: Date, limit: number): PostRow[] {
      return db
        .select()
        .from(posts)
        .where(and(isNull(posts.contentPurgedAt), lt(posts.collectedAt, cutoff)))
        .limit(limit)
        .all();
    },

    /** Clears raw text (post + OCR); everything else — URL, author, categories, job rows — is kept (grill Q7(c)). */
    purgeContent(id: string, purgedAt: Date): void {
      db.update(posts)
        .set({ content: '', ocrText: null, contentPurgedAt: purgedAt })
        .where(eq(posts.id, id))
        .run();
    },

    listFailed(limit = 100): PostRow[] {
      return db.select().from(posts).where(eq(posts.processingStatus, 'failed')).limit(limit).all();
    },

    listDropped(limit = 200): PostRow[] {
      return db
        .select()
        .from(posts)
        .where(and(eq(posts.processingStatus, 'dropped')))
        .limit(limit)
        .all();
    },
  };
}

export type PostsRepository = ReturnType<typeof createPostsRepository>;
