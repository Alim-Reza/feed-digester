import { eq } from 'drizzle-orm';
import type { DbClient } from '../client';
import { newId } from '../ids';
import { postImages } from '../schema';

export type PostImageRow = typeof postImages.$inferSelect;

export function createPostImagesRepository(db: DbClient) {
  return {
    /**
     * Recorded right after a live element screenshot (collect stage, slice 4). `kept` stays
     * true until OCR (slice 5) checks whether the extracted text makes sense — if it doesn't,
     * the image is discarded (grill C5).
     */
    add(postId: string, path: string): PostImageRow {
      const row = { id: newId(), postId, path, kept: true as const };
      db.insert(postImages).values(row).run();
      return db.select().from(postImages).where(eq(postImages.id, row.id)).get()!;
    },

    listForPost(postId: string): PostImageRow[] {
      return db.select().from(postImages).where(eq(postImages.postId, postId)).all();
    },

    /** Records the OCR stage's verdict for one image: its recognized text and whether it passed the "looks like real text" check (grill C5). */
    setOcrResult(id: string, result: { text: string; kept: boolean }): void {
      db.update(postImages)
        .set({ ocrText: result.text, kept: result.kept })
        .where(eq(postImages.id, id))
        .run();
    },

    /** Removes every image row for a post — the `retention` stage's counterpart to deleting the files themselves. */
    deleteForPost(postId: string): void {
      db.delete(postImages).where(eq(postImages.postId, postId)).run();
    },
  };
}

export type PostImagesRepository = ReturnType<typeof createPostImagesRepository>;
