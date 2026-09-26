import { z } from 'zod';
import type { LLMProvider } from '../../llm/types';
import type { InsightEvaluation, PersonalizationContext, SourcePost } from './types';

const DEFAULT_MAX_RETRIES = 2;

const insightLevelSchema = z.enum(['low', 'medium', 'high']);

const insightResponseSchema = z.object({
  isInsight: z.boolean(),
  title: z.string(),
  summary: z.string(),
  whyItMatters: z.string(),
  suggestedAction: z.string().nullable(),
  noveltyLevel: insightLevelSchema,
  confidence: insightLevelSchema,
});

function profileBlock(profile?: PersonalizationContext): string {
  if (!profile) return '';
  const lines: string[] = [];
  if (profile.interests.length > 0) lines.push(`Interests: ${profile.interests.join(', ')}`);
  if (profile.goals.length > 0) lines.push(`Goals: ${profile.goals.join(', ')}`);
  if (profile.alreadyFamiliarWith.length > 0) {
    lines.push(
      `Already familiar with (do not flag these as novel just for showing up): ${profile.alreadyFamiliarWith.join(', ')}`,
    );
  }
  if (lines.length === 0) return '';
  return [
    '',
    "Reader profile (use this only to judge relevance/novelty for THIS reader, never to invent facts not in the posts):",
    ...lines,
  ].join('\n');
}

/**
 * Frames the extraction the way spec-second.md §10 asks for, not "summarize these posts": the
 * model must actively decide whether there's a concrete claim worth keeping, with permission to
 * say no. `sourcePostIds`/citations are deliberately NOT part of this schema — the cluster's
 * membership (`topicClusterPosts`, already deterministic) is the insight's full source list, so
 * there's nothing here for the model to cite or hallucinate an index for.
 */
function buildInsightPrompt(
  categoryLabel: string,
  posts: readonly SourcePost[],
  profile?: PersonalizationContext,
): string {
  const sourcesBlock = posts.map((p, i) => `[${i + 1}] ${p.content}`).join('\n\n');
  return [
    `The posts below are all in the "${categoryLabel}" category and were grouped together because they discuss the same idea.`,
    "After reading these posts so the reader doesn't have to, identify only the claims, techniques, opportunities, disagreements, or ideas worth adding to an experienced software engineer's mental model.",
    'Discard motivational filler, generic advice, repeated truisms, promotional wording, and obvious statements — prefer information loss over retaining noise. If nothing here clears that bar, set isInsight to false and leave the other fields empty; do not force a generic insight into existence.',
    'Examples of LOW novelty (isInsight should usually be false): "keep learning continuously", "DSA matters for interviews", "AI is changing software engineering", "communication matters for leadership".',
    'Examples of HIGH novelty (isInsight can be true): a concrete technique, a specific architectural pattern, an interesting tradeoff, a practical workflow, a new tool, a disagreement between practitioners, an unexpected engineering lesson, a specific hiring signal.',
    'If there is a real insight, synthesize ONE combined claim across all the posts below — do not just describe what the topic is about, and never use a bare category name as the title.',
    profileBlock(profile),
    '',
    'If isInsight is true, also give:',
    '- title: states the actual insight, e.g. "One coordinating agent may reduce the cognitive cost of managing multiple coding agents" (bad: "AI and Software Engineering").',
    '- summary: the concrete claim/idea in 1-3 sentences.',
    '- whyItMatters: why this specific reader should care.',
    '- suggestedAction: a short next step ("Try this workflow", "Investigate tool", "Relevant for interview prep", "Read source"), or null if none applies — never force one.',
    '- noveltyLevel / confidence: "low", "medium", or "high" — your own confidence that this is a concrete, well-supported claim, not a guess about how much the reader will like it.',
    '',
    sourcesBlock,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * The one semantic check a JSON schema can't express: an "insight" with an empty title/summary
 * isn't a real insight. Same reject-and-retry discipline as the old citation check it replaces
 * (CLAUDE.md: "citations are validated, never trusted") — applied here to insight *quality*
 * instead of citation indices, since there's no citation index left to validate.
 */
function assertValidInsight(result: InsightEvaluation): void {
  if (!result.isInsight) return;
  if (result.title.trim() === '') throw new Error('insight marked isInsight but has an empty title');
  if (result.summary.trim() === '') throw new Error('insight marked isInsight but has an empty summary');
  if (result.whyItMatters.trim() === '') {
    throw new Error('insight marked isInsight but has an empty whyItMatters');
  }
}

/**
 * LLM-backed insight evaluator for the `summarize` stage — one `generateObject` call per topic
 * cluster. Not a swappable `Classifier`-style interface: nothing in the spec asks this to be
 * pluggable, so this is a plain factory over `LLMProvider` (itself already swappable).
 */
export function createSummarizer(opts: { llm: LLMProvider; maxRetries?: number }) {
  const { llm } = opts;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

  return {
    async evaluateCluster(
      categoryLabel: string,
      posts: readonly SourcePost[],
      profile?: PersonalizationContext,
    ): Promise<InsightEvaluation> {
      const prompt = buildInsightPrompt(categoryLabel, posts, profile);
      let lastErr: unknown;
      for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
          const object = await llm.generateObject({
            schema: insightResponseSchema,
            prompt,
            system:
              'You extract specific, concrete insights from grouped LinkedIn posts for a busy reader. Prefer saying there is no insight over inventing a generic one.',
          });
          const result: InsightEvaluation = object.isInsight
            ? {
                isInsight: true,
                title: object.title,
                summary: object.summary,
                whyItMatters: object.whyItMatters,
                suggestedAction: object.suggestedAction,
                noveltyLevel: object.noveltyLevel,
                confidence: object.confidence,
              }
            : { isInsight: false };
          assertValidInsight(result);
          return result;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr instanceof Error
        ? lastErr
        : new Error('insight extraction failed validation after retries');
    },

    release: () => llm.release(),
  };
}

export type Summarizer = ReturnType<typeof createSummarizer>;
