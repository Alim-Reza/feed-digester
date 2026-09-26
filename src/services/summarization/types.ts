export type SourcePost = {
  authorName: string;
  content: string;
  url: string | null;
};

export const insightLevels = ['low', 'medium', 'high'] as const;
export type InsightLevel = (typeof insightLevels)[number];

/** spec-second.md §6: the reader's interests/goals/already-known list, threaded into the insight prompt and the ranking bonus. Empty lists change nothing. */
export type PersonalizationContext = {
  interests: string[];
  goals: string[];
  alreadyFamiliarWith: string[];
};

/**
 * What one topic cluster evaluates to (spec-second.md §5). `isInsight: false` means the cluster
 * was judged generic/low-value and should not appear in the briefing at all — there's no "empty
 * summary" version of an insight, only "no insight here."
 */
export type InsightEvaluation =
  | { isInsight: false }
  | {
      isInsight: true;
      title: string;
      summary: string;
      whyItMatters: string;
      suggestedAction: string | null;
      noveltyLevel: InsightLevel;
      confidence: InsightLevel;
    };
