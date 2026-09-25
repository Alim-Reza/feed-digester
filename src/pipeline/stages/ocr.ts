import fs from 'node:fs';
import type { Stage, StageContext } from '../types';
import type { OcrProvider } from '../../services/ocr/provider';
import { createTesseractOcrProvider } from '../../services/ocr/tesseractProvider';
import { looksLikeRealText } from '../../services/ocr/textCheck';

const BATCH_SIZE = 25;

type BatchResult = {
  postId: string;
  ocrText: string | null;
  imageUpdates: { id: string; text: string; kept: boolean }[];
};

/**
 * Runs one batch's OCR work (recognize each kept image, decide keep/discard) without touching
 * the DB — better-sqlite3 transactions must run synchronously, so this async I/O has to
 * complete *before* the batch's writes are committed in one transaction, not inside it (unlike
 * `runBatchLoop`, which assumes a synchronous `processBatch`).
 *
 * `getProvider` lazily creates (and memoizes) the OCR provider only once a post actually needs
 * it, so a batch with no image posts never loads a trained-data model at all.
 */
async function recognizeBatch(
  ctx: StageContext,
  getProvider: () => Promise<OcrProvider>,
  postIds: string[],
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];
  for (const postId of postIds) {
    const images = ctx.repos.postImages.listForPost(postId).filter((img) => img.kept);
    if (images.length === 0) {
      results.push({ postId, ocrText: null, imageUpdates: [] });
      continue;
    }

    const provider = await getProvider();
    const imageUpdates: BatchResult['imageUpdates'] = [];
    const keptTexts: string[] = [];
    for (const image of images) {
      let text = '';
      try {
        text = await provider.recognize(image.path);
      } catch (err) {
        ctx.logger.warn({ postId, imageId: image.id, err }, 'ocr: recognize failed');
      }
      const kept = looksLikeRealText(text);
      imageUpdates.push({ id: image.id, text, kept });
      if (kept) keptTexts.push(text);
      else {
        try {
          fs.unlinkSync(image.path);
        } catch {
          // best-effort — file may already be gone
        }
      }
    }
    results.push({
      postId,
      ocrText: keptTexts.length > 0 ? keptTexts.join('\n\n') : null,
      imageUpdates,
    });
  }
  return results;
}

function commitBatch(ctx: StageContext, results: BatchResult[]): void {
  ctx.db.transaction(() => {
    for (const result of results) {
      for (const update of result.imageUpdates) {
        ctx.repos.postImages.setOcrResult(update.id, { text: update.text, kept: update.kept });
      }
      ctx.repos.posts.updateStatus(
        result.postId,
        'ocr_done',
        result.ocrText !== null ? { ocrText: result.ocrText } : {},
      );
    }
  });
}

/**
 * Runs OCR on every kept screenshot of posts in `new` status (grill C5), then advances them to
 * `ocr_done` regardless — most posts have no images at all and just pass through untouched.
 */
export async function runOcrStage(
  ctx: StageContext,
  createProvider: () => Promise<OcrProvider> = createTesseractOcrProvider,
): Promise<void> {
  const providerRef: { current: OcrProvider | null } = { current: null };
  const getProvider = async (): Promise<OcrProvider> => {
    if (!providerRef.current) providerRef.current = await createProvider();
    return providerRef.current;
  };

  let batches = 0;
  let items = 0;
  try {
    for (;;) {
      const batch = ctx.repos.posts.listByStatus('new', BATCH_SIZE);
      if (batch.length === 0) break;

      const results = await recognizeBatch(
        ctx,
        getProvider,
        batch.map((p) => p.id),
      );
      commitBatch(ctx, results);
      batches += 1;
      items += batch.length;
    }
  } finally {
    if (providerRef.current) await providerRef.current.dispose();
  }
  ctx.logger.info({ stage: 'ocr', batches, items }, 'ocr: advanced posts');
}

export const ocr: Stage = {
  name: 'ocr',
  run: (ctx) => runOcrStage(ctx),
};
