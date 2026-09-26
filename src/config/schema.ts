import { z } from 'zod';

export const categoryIdSchema = z.enum([
  'software_engineering',
  'ai_ml',
  'career',
  'engineering_leadership',
  'industry_news',
  'job',
]);
export type CategoryId = z.infer<typeof categoryIdSchema>;

const categoryConfigSchema = z.object({
  id: categoryIdSchema,
  label: z.string(),
  description: z.string(),
});
export type CategoryConfig = z.infer<typeof categoryConfigSchema>;

const thresholdsSchema = z.object({
  /** Minimum normalized relevance (0..1) for a post to survive classification. */
  relevance: z.number().min(0).max(1),
  /** Minimum job-category confidence for a post to go through job extraction. */
  job: z.number().min(0).max(1),
  /** Minimum cluster score for a cluster to be summarized. */
  clusterScore: z.number().min(0).max(1),
});

const filteringSchema = z.object({
  /** Phrases that mark a "humblebrag" celebration post to drop. Case-insensitive substring match. */
  celebrationPhrases: z.array(z.string()),
  /**
   * Phrases that mark generic motivational filler / engagement bait to drop before it ever
   * reaches classification (spec-second.md §2, reactivating grill D7's deferred "engagement-bait
   * filter" on purpose — see docs/decisions.md). Same cheap substring-match mechanism as
   * `celebrationPhrases`, just a different drop reason.
   */
  lowValuePhrases: z.array(z.string()),
  /** Author names or handles to always keep, skipping every other rule. */
  allowlist: z.array(z.string()),
  /** Author names, handles, or domains to always drop. */
  blocklist: z.array(z.string()),
  /** Languages allowed through the language filter. */
  allowedLanguages: z.array(z.enum(['en', 'bn'])),
  /** Minimum text length (characters) for a video post to survive. */
  minVideoTextLength: z.number().int().positive(),
});

const pacingSchema = z.object({
  scrollStepPxMin: z.number().int().positive(),
  scrollStepPxMax: z.number().int().positive(),
  pauseMsMin: z.number().int().positive(),
  pauseMsMax: z.number().int().positive(),
  readingPauseChance: z.number().min(0).max(1),
  readingPauseMsMin: z.number().int().positive(),
  readingPauseMsMax: z.number().int().positive(),
});

const stopConditionsSchema = z.object({
  maxDurationMinutes: z.number().int().positive(),
  maxPosts: z.number().int().positive(),
  maxConsecutiveSeenPosts: z.number().int().positive(),
  maxRunsPerDay: z.number().int().positive(),
  checkpointWaitMinutes: z.number().int().positive(),
  checkpointPollSeconds: z.number().int().positive(),
});

const scheduleSchema = z.object({
  enabled: z.boolean(),
  dailyAt: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string(),
});

const modelsSchema = z.object({
  ollamaHost: z.string().url(),
  llm: z.string(),
  embedding: z.string(),
  llmKeepAliveSeconds: z.number().int().min(0),
});

const groqSchema = z.object({
  enabled: z.boolean(),
  model: z.string(),
});

const retentionSchema = z.object({
  /** Purge raw post content after this many completed runs. */
  keepCompletedRuns: z.number().int().positive(),
});

const profileSchema = z.object({
  active: z.string(),
  names: z.array(z.string()),
});

/**
 * Which `Classifier` (src/services/classification/) the `classify` stage uses — a config change,
 * not a rewrite. ADR 0003's bake-off (101 real posts, judged by an external model against both
 * classifiers' raw output) decided `gemma4`: sharper, more semantically accurate category
 * calls than Laya, at the cost of Laya still being the better-calibrated one for relevance —
 * see `relevanceWeights` below, which is how gemma4 keeps its category-accuracy edge without
 * inheriting its own overconfident relevance number.
 */
const classificationSchema = z.object({
  active: z.enum(['laya', 'gemma4']),
  /**
   * gemma4 only (ADR 0003): instead of trusting the LLM's own "relevance" number — the bake-off
   * found it badly calibrated, scoring 65/101 posts >=0.8 versus Laya's 1/101 — relevance is
   * computed deterministically as a weighted sum of gemma4's own per-category confidence
   * scores. Every configured category needs a weight (0 is valid — it just means that category
   * never contributes to relevance); weights are normalized by their sum, so they don't need to
   * add up to exactly 1.
   */
  relevanceWeights: z.record(categoryIdSchema, z.number().min(0)),
});

const jobsSchema = z.object({
  /** Case-insensitive skill -> canonical name, e.g. "k8s" -> "Kubernetes" (grill G4). Unknown skills pass through unchanged. */
  skillAliases: z.record(z.string(), z.string()),
});

/**
 * spec-second.md §6: reactivating grill part-2/3 Q3's deliberately-deferred "personal relevance
 * profile" (the old `relevanceProfile` free-text field was scaffolded for exactly this and never
 * wired to anything — see docs/decisions.md). All three lists are free text, matched as
 * case-insensitive substrings against insight titles/summaries — no embeddings, no extra LLM
 * call, per CLAUDE.md's "no overengineering" ground rule. Empty by default: an empty profile
 * changes nothing, matching the pre-existing "general judgement, no profile" behavior.
 */
const personalProfileSchema = z.object({
  interests: z.array(z.string()),
  goals: z.array(z.string()),
  alreadyFamiliarWith: z.array(z.string()),
});

/**
 * Deterministic ranking weights for the finite briefing (spec-second.md §7). Deliberately NOT an
 * LLM-scored "usefulness" number — ADR 0003 already found that an LLM asked to self-report an
 * open relevance score is badly miscalibrated (65/101 posts scored >=0.8). Every weighted input
 * here is either already-deterministic (cohesion, source count, category weight) or a categorical
 * LLM judgment (novelty), never a raw LLM float. Weights are normalized by their sum in
 * `rankInsights`, so they don't need to add up to exactly 1.
 */
const briefingSchema = z.object({
  /** Top-N insights that make the final briefing (spec-second.md §7: "approximately 5-10"). */
  maxInsights: z.number().int().positive(),
  weights: z.object({
    cohesion: z.number().min(0),
    sourceCount: z.number().min(0),
    novelty: z.number().min(0),
    categoryRelevance: z.number().min(0),
    profileMatch: z.number().min(0),
  }),
});

export const digestConfigSchema = z.object({
  categories: z.array(categoryConfigSchema).min(1),
  thresholds: thresholdsSchema,
  filtering: filteringSchema,
  pacing: pacingSchema,
  stopConditions: stopConditionsSchema,
  schedule: scheduleSchema,
  models: modelsSchema,
  groq: groqSchema,
  retention: retentionSchema,
  profiles: profileSchema,
  classification: classificationSchema,
  jobs: jobsSchema,
  profile: personalProfileSchema,
  briefing: briefingSchema,
  dataDir: z.string(),
});

export type DigestConfig = z.infer<typeof digestConfigSchema>;

/** Deep-partial override shape, as stored in the `settings` table (slice 1+) or passed at load time. */
export type DigestConfigOverrides = {
  [K in keyof DigestConfig]?: DigestConfig[K] extends object
    ? Partial<DigestConfig[K]>
    : DigestConfig[K];
};
