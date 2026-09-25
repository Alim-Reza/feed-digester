import type { Stage, StageContext } from '../types';
import type { PostRow } from '../../db/repositories/posts';
import { createLLMProvider } from '../../llm';
import { createJobExtractor, type JobExtractor } from '../../services/jobs/extractor';

const BATCH_SIZE = 25;

function needsExtraction(ctx: StageContext, post: PostRow): boolean {
  const analysis = ctx.repos.postAnalysis.get(post.id);
  const score = analysis?.categories['job'] ?? 0;
  return score >= ctx.config.thresholds.job;
}

/**
 * Runs job extraction on one batch's `job`-relevant posts (spec's "Do not send every raw post
 * to a general-purpose LLM" — most posts never reach the LLM here at all) and advances every
 * post in the batch to `enriched` either way. Two separate transactions per batch: the skip
 * list always commits; the extracted list only commits if the LLM call succeeded, so a failure
 * there doesn't lose the skip list's already-decided (cheap, deterministic) work.
 */
export async function runExtractJobsStage(
  ctx: StageContext,
  createExtractor: (ctx: StageContext) => JobExtractor = (c) =>
    createJobExtractor({
      llm: createLLMProvider(c.config, c.logger),
      skillAliases: c.config.jobs.skillAliases,
    }),
): Promise<void> {
  const extractorRef: { current: JobExtractor | null } = { current: null };
  const getExtractor = (): JobExtractor => {
    if (!extractorRef.current) extractorRef.current = createExtractor(ctx);
    return extractorRef.current;
  };

  const attemptedThisRun = new Set<string>();
  let batches = 0;
  let items = 0;

  try {
    for (;;) {
      const candidates = ctx.repos.posts.listByStatus(
        'classified',
        BATCH_SIZE + attemptedThisRun.size,
      );
      const batch = candidates.filter((p) => !attemptedThisRun.has(p.id)).slice(0, BATCH_SIZE);
      if (batch.length === 0) break;

      const toExtract = batch.filter((p) => needsExtraction(ctx, p));
      const toSkip = batch.filter((p) => !toExtract.includes(p));

      ctx.db.transaction(() => {
        for (const post of toSkip) ctx.repos.posts.updateStatus(post.id, 'enriched');
      });

      if (toExtract.length > 0) {
        const extractor = getExtractor();
        try {
          const inputs = toExtract.map((p) => ({
            authorName: p.authorName,
            content: p.content,
            ocrText: p.ocrText,
          }));
          const results = await extractor.extractBatch(inputs);

          ctx.db.transaction(() => {
            toExtract.forEach((post, i) => {
              const extraction = results[i]!;
              if (extraction.isHiringPost) {
                for (const role of extraction.roles) {
                  ctx.repos.jobOpenings.insert({
                    postId: post.id,
                    company: role.company,
                    role: role.role,
                    location: role.location,
                    remoteStatus: role.remoteStatus,
                    seniority: role.seniority,
                    experience: role.experience,
                    skills: role.skills,
                    model: extractor.model,
                  });
                }
              }
              ctx.repos.posts.updateStatus(post.id, 'enriched');
            });
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          ctx.logger.warn(
            { stage: 'extract-jobs', ids: toExtract.map((p) => p.id), err },
            'extract-jobs: batch failed, recording attempt failures',
          );
          for (const post of toExtract) {
            attemptedThisRun.add(post.id);
            ctx.repos.posts.recordAttemptFailure(post.id, message);
          }
        }
      }

      batches += 1;
      items += batch.length;
    }
  } finally {
    if (extractorRef.current) await extractorRef.current.release();
  }
  ctx.logger.info({ stage: 'extract-jobs', batches, items }, 'extract-jobs: advanced posts');
}

export const extractJobs: Stage = {
  name: 'extract-jobs',
  run: (ctx) => runExtractJobsStage(ctx),
};
