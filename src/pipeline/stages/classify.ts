import type { Stage, StageContext } from '../types';
import type { Classifier, ClassificationInput, ClassificationResult } from '../../services/classification/types';
import { createClassifier } from '../../services/classification';

const BATCH_SIZE = 25;

type BatchResult = { postId: string } & ClassificationResult;

/**
 * Runs one batch's classification without touching the DB — like `ocr.ts`, better-sqlite3
 * transactions must be synchronous, so this async LLM/ONNX work has to finish before the
 * batch's writes are committed in one transaction, not inside it.
 */
async function classifyBatch(
  ctx: StageContext,
  classifier: Classifier,
  postIds: string[],
): Promise<BatchResult[]> {
  const posts = postIds
    .map((id) => ctx.repos.posts.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);
  const inputs: ClassificationInput[] = posts.map((p) => ({
    authorName: p.authorName,
    authorHeadline: p.authorHeadline,
    content: p.content,
    ocrText: p.ocrText,
    language: p.language,
  }));
  const results = await classifier.classifyBatch(inputs);
  return posts.map((p, i) => ({ postId: p.id, ...results[i]! }));
}

/**
 * Writes each post's analysis and, per spec's "relevance scoring" step, advances only posts at
 * or above `thresholds.relevance` to `classified` — the rest go `dropped` (`low_relevance`),
 * same as filter.ts's drop pattern, so job extraction/clustering only ever sees posts worth the
 * LLM spend. The analysis row is kept either way (visible in the UI, and it's the ground truth
 * the ADR 0003 bake-off eval script reads).
 */
function commitBatch(ctx: StageContext, classifier: Classifier, results: BatchResult[]): void {
  ctx.db.transaction(() => {
    for (const result of results) {
      ctx.repos.postAnalysis.upsert({
        postId: result.postId,
        categories: result.categories,
        primaryCategory: result.primaryCategory,
        relevance: result.relevance,
        classifier: classifier.name,
        model: classifier.model,
        processedAt: new Date(),
      });
      if (result.relevance >= ctx.config.thresholds.relevance) {
        ctx.repos.posts.updateStatus(result.postId, 'classified');
      } else {
        ctx.repos.posts.updateStatus(result.postId, 'dropped', { dropReason: 'low_relevance' });
      }
    }
  });
}

export async function runClassifyStage(
  ctx: StageContext,
  createClassifierForStage: (ctx: StageContext) => Classifier = (c) =>
    createClassifier(c.config, c.logger),
): Promise<void> {
  const classifier = createClassifierForStage(ctx);
  // Posts a failed batch already recorded an attempt for, so a `filtered`-status re-query
  // within this same run doesn't just pick the same broken batch again — retries across
  // batches within one run don't help if e.g. Ollama is down, only a later run does.
  const attemptedThisRun = new Set<string>();
  let batches = 0;
  let items = 0;
  try {
    for (;;) {
      const candidates = ctx.repos.posts.listByStatus('filtered', BATCH_SIZE + attemptedThisRun.size);
      const batch = candidates.filter((p) => !attemptedThisRun.has(p.id)).slice(0, BATCH_SIZE);
      if (batch.length === 0) break;
      const ids = batch.map((p) => p.id);

      let results: BatchResult[];
      try {
        results = await classifyBatch(ctx, classifier, ids);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.logger.warn({ stage: 'classify', ids, err }, 'classify: batch failed, recording attempt failures');
        for (const id of ids) {
          attemptedThisRun.add(id);
          ctx.repos.posts.recordAttemptFailure(id, message);
        }
        batches += 1;
        items += ids.length;
        continue;
      }

      commitBatch(ctx, classifier, results);
      batches += 1;
      items += ids.length;
    }
  } finally {
    await classifier.release();
  }
  ctx.logger.info({ stage: 'classify', batches, items }, 'classify: advanced posts');
}

export const classify: Stage = {
  name: 'classify',
  run: (ctx) => runClassifyStage(ctx),
};
