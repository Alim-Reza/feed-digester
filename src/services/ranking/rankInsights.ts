import type { InsightLevel } from '../../db/schema';

export type RankableInsight = {
  id: string;
  category: string;
  title: string;
  summary: string;
  /** The cluster's cohesion score (0..1), i.e. `topicClusters.score`. */
  cohesion: number;
  sourceCount: number;
  noveltyLevel: InsightLevel;
};

export type RankingWeights = {
  cohesion: number;
  sourceCount: number;
  novelty: number;
  categoryRelevance: number;
  profileMatch: number;
};

export type RankInsightsOptions = {
  weights: RankingWeights;
  /** Reused from `config.classification.relevanceWeights` rather than a second, parallel per-category scheme. */
  categoryRelevanceWeights: Record<string, number>;
  /** Free-text interests/goals (spec-second.md §6) matched as substrings against title+summary. */
  profileKeywords: readonly string[];
  maxInsights: number;
};

const NOVELTY_SCORE: Record<InsightLevel, number> = { low: 0.2, medium: 0.6, high: 1 };

function normalizeSourceCount(count: number, maxObserved: number): number {
  if (maxObserved <= 1) return 0;
  return Math.min(1, (count - 1) / (maxObserved - 1));
}

function matchesProfile(text: string, keywords: readonly string[]): boolean {
  if (keywords.length === 0) return false;
  const lower = text.toLowerCase();
  return keywords.some((k) => k.trim() !== '' && lower.includes(k.trim().toLowerCase()));
}

/**
 * Deterministic composite score for the finite briefing (spec-second.md §7). Every input is
 * either already-deterministic (cohesion, source count, the reader's own category weighting) or a
 * categorical LLM judgment (novelty) — never a raw LLM-self-reported float. This is a deliberate
 * departure from spec-second.md §1's literal "usefulness = relevance + novelty + specificity +
 * actionability + credibility" sum: ADR 0003 already found that asking an LLM to self-report an
 * open relevance number produces badly miscalibrated results (65/101 posts scored >=0.8) — see
 * docs/decisions.md for the full rationale. Weights are normalized by their sum, so config
 * doesn't need to keep them summing to exactly 1.
 */
export function rankInsights(
  insights: readonly RankableInsight[],
  opts: RankInsightsOptions,
): { id: string; rank: number }[] {
  if (insights.length === 0) return [];

  const maxSourceCount = Math.max(...insights.map((i) => i.sourceCount));
  const maxCategoryWeight = Math.max(1e-9, ...Object.values(opts.categoryRelevanceWeights));
  const totalWeight = Object.values(opts.weights).reduce((a, b) => a + b, 0) || 1;

  const scored = insights.map((insight) => {
    const categoryWeight = (opts.categoryRelevanceWeights[insight.category] ?? 0) / maxCategoryWeight;
    const profileBoost = matchesProfile(`${insight.title} ${insight.summary}`, opts.profileKeywords) ? 1 : 0;
    const weightedSum =
      insight.cohesion * opts.weights.cohesion +
      normalizeSourceCount(insight.sourceCount, maxSourceCount) * opts.weights.sourceCount +
      NOVELTY_SCORE[insight.noveltyLevel] * opts.weights.novelty +
      categoryWeight * opts.weights.categoryRelevance +
      profileBoost * opts.weights.profileMatch;
    return { id: insight.id, score: weightedSum / totalWeight };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxInsights)
    .map((s, i) => ({ id: s.id, rank: i + 1 }));
}

/** Deterministic ~30s/insight + fixed overhead, clamped to at least a minute once there's anything to read (spec-second.md §7: "approximately 3-5 minutes"). */
export function estimateReadingMinutes(insightCount: number): number {
  if (insightCount === 0) return 0;
  return Math.max(1, Math.round((insightCount * 30 + 30) / 60));
}
