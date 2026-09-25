import { runBatchLoop } from '../batch';
import type { Stage } from '../types';
import type { DigestConfig } from '../../config/schema';
import { detectLanguage } from '../../services/language/detect';

export type FilterInput = {
  authorName: string;
  content: string;
  contentType: string;
  ocrText: string | null;
  isSponsored: boolean;
  isConnectionSuggestion: boolean;
  isPoll: boolean;
};

export type FilterOutcome =
  { keep: true; language: string } | { keep: false; reason: string; language: string };

function matchesAny(haystack: string, needles: readonly string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => needle.trim() !== '' && lower.includes(needle.toLowerCase()));
}

/**
 * Cheap deterministic filtering (spec's "Cheap deterministic filtering" step, grill D1/D2/C6):
 * no LLM, just rules. Allowlist wins over every other rule (config/schema.ts's own comment);
 * everything else after it is a drop reason, checked in order, first match wins. Language is
 * detected and returned either way so it's persisted on the post even when something else
 * already decided the outcome — useful for the UI later.
 */
export function decideFilter(post: FilterInput, config: DigestConfig['filtering']): FilterOutcome {
  const haystack = `${post.authorName} ${post.content}`;
  const language = detectLanguage(`${post.content} ${post.ocrText ?? ''}`.trim());

  if (matchesAny(haystack, config.allowlist)) return { keep: true, language };
  if (matchesAny(haystack, config.blocklist))
    return { keep: false, reason: 'blocklisted', language };
  if (post.isSponsored) return { keep: false, reason: 'sponsored', language };
  if (post.isConnectionSuggestion) {
    return { keep: false, reason: 'connection_suggestion', language };
  }
  if (post.isPoll) return { keep: false, reason: 'poll', language };
  if (matchesAny(post.content, config.celebrationPhrases)) {
    return { keep: false, reason: 'celebration', language };
  }
  if (post.contentType === 'video' && post.content.length < config.minVideoTextLength) {
    return { keep: false, reason: 'video_low_text', language };
  }
  if (!(config.allowedLanguages as readonly string[]).includes(language)) {
    return { keep: false, reason: 'language_not_allowed', language };
  }
  return { keep: true, language };
}

export const filter: Stage = {
  name: 'filter',
  run(ctx) {
    const { batches, items } = runBatchLoop(ctx.db, {
      selectBatch: (limit) => ctx.repos.posts.listByStatus('ocr_done', limit).map((p) => p.id),
      processBatch: (ids) => {
        for (const id of ids) {
          const post = ctx.repos.posts.get(id);
          if (!post) continue;
          const outcome = decideFilter(post, ctx.config.filtering);
          if (outcome.keep) {
            ctx.repos.posts.updateStatus(id, 'filtered', { language: outcome.language });
          } else {
            ctx.repos.posts.updateStatus(id, 'dropped', {
              language: outcome.language,
              dropReason: outcome.reason,
            });
          }
        }
      },
    });
    ctx.logger.info({ stage: 'filter', batches, items }, 'filter: advanced posts');
  },
};
