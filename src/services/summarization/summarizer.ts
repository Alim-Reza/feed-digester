import { z } from 'zod';
import type { LLMProvider } from '../../llm/types';
import type { ClusterSummary, SourcePost } from './types';

const MIN_BULLETS = 1;
const MAX_BULLETS = 4;
const DEFAULT_MAX_RETRIES = 2;

const summarySchema = z.object({
  title: z.string().min(1),
  bullets: z
    .array(z.object({ text: z.string().min(1), sources: z.array(z.number().int().min(1)) }))
    .min(MIN_BULLETS)
    .max(MAX_BULLETS),
});

function buildClusterPrompt(categoryLabel: string, posts: readonly SourcePost[]): string {
  const sourcesBlock = posts.map((p, i) => `[${i + 1}] ${p.content}`).join('\n\n');
  return [
    `The posts below, all in the "${categoryLabel}" category, are one topic in a digest.`,
    'Write a short topic title and 2-4 bullet points summarizing what this topic is and why it matters.',
    'Every bullet must end with citations to the source post numbers it is based on, e.g. "...scaled to 10x traffic [1][2]." Do not name authors in the bullet text — cite by number only.',
    'Only cite numbers from the list below; never invent a number that is not listed.',
    '',
    sourcesBlock,
  ].join('\n');
}

function buildSectionPrompt(categoryLabel: string, topicTitles: readonly string[]): string {
  return [
    `Write a 2-3 sentence TL;DR for the "${categoryLabel}" section of a digest, covering these topics:`,
    topicTitles.map((t) => `- ${t}`).join('\n'),
  ].join('\n');
}

/**
 * Per CLAUDE.md's "citations are validated, never trusted" rule (grill H5: "every claim in a
 * summary point[s] back to the posts it came from, to protect against hallucination") — every
 * bullet's `sources` must reference a source post number that was actually given; anything else
 * is rejected and retried by the caller, never silently trusted.
 */
function assertValidCitations(summary: ClusterSummary, sourceCount: number): void {
  for (const bullet of summary.bullets) {
    for (const source of bullet.sources) {
      if (source < 1 || source > sourceCount) {
        throw new Error(`summary cites source [${source}], but only ${sourceCount} sources were given`);
      }
    }
  }
}

/**
 * LLM-backed summarizer for the `summarize` stage — one `generateObject` call per topic cluster
 * (title + cited bullets) and one per category (section TL;DR). Not a swappable `Classifier`-
 * style interface: unlike classification, nothing in the spec asks summarization to be
 * pluggable, so this is a plain factory over `LLMProvider` (itself already swappable).
 */
export function createSummarizer(opts: { llm: LLMProvider; maxRetries?: number }) {
  const { llm } = opts;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

  return {
    async summarizeCluster(
      categoryLabel: string,
      posts: readonly SourcePost[],
    ): Promise<ClusterSummary> {
      const prompt = buildClusterPrompt(categoryLabel, posts);
      let lastErr: unknown;
      for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
          const object = await llm.generateObject({
            schema: summarySchema,
            prompt,
            system:
              'You write concise, accurate digest summaries. Never cite a source number that was not given to you.',
          });
          assertValidCitations(object, posts.length);
          return object;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr instanceof Error
        ? lastErr
        : new Error('summarization failed citation validation after retries');
    },

    async summarizeSection(categoryLabel: string, topicTitles: readonly string[]): Promise<string> {
      const object = await llm.generateObject({
        schema: z.object({ tldr: z.string().min(1) }),
        prompt: buildSectionPrompt(categoryLabel, topicTitles),
        system: 'You write concise digest section summaries.',
      });
      return object.tldr;
    },

    release: () => llm.release(),
  };
}

export type Summarizer = ReturnType<typeof createSummarizer>;
