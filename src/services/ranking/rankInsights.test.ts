import { describe, expect, it } from 'vitest';
import { estimateReadingMinutes, rankInsights, type RankableInsight } from './rankInsights';

const baseWeights = { cohesion: 0.2, sourceCount: 0.2, novelty: 0.35, categoryRelevance: 0.15, profileMatch: 0.1 };

function insight(overrides: Partial<RankableInsight> = {}): RankableInsight {
  return {
    id: 'i1',
    category: 'software_engineering',
    title: 'A concrete claim',
    summary: 'A concrete summary.',
    cohesion: 0.5,
    sourceCount: 1,
    noveltyLevel: 'medium',
    ...overrides,
  };
}

describe('rankInsights', () => {
  it('returns nothing for an empty input', () => {
    expect(rankInsights([], { weights: baseWeights, categoryRelevanceWeights: {}, profileKeywords: [], maxInsights: 8 })).toEqual([]);
  });

  it('ranks a high-novelty insight above a low-novelty one, all else equal', () => {
    const high = insight({ id: 'high', noveltyLevel: 'high' });
    const low = insight({ id: 'low', noveltyLevel: 'low' });

    const ranked = rankInsights([low, high], {
      weights: baseWeights,
      categoryRelevanceWeights: { software_engineering: 1 },
      profileKeywords: [],
      maxInsights: 8,
    });

    expect(ranked.find((r) => r.id === 'high')!.rank).toBeLessThan(ranked.find((r) => r.id === 'low')!.rank);
  });

  it('caps the result at maxInsights, dropping the lowest-scored ones', () => {
    const insights = Array.from({ length: 12 }, (_, i) => insight({ id: `i${i}`, cohesion: i / 12 }));

    const ranked = rankInsights(insights, {
      weights: baseWeights,
      categoryRelevanceWeights: { software_engineering: 1 },
      profileKeywords: [],
      maxInsights: 5,
    });

    expect(ranked).toHaveLength(5);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('a relevant but obvious (low-novelty) insight does not automatically rank highly despite a high category weight', () => {
    const obviousButRelevant = insight({ id: 'obvious', noveltyLevel: 'low', category: 'software_engineering' });
    const nicheButNovel = insight({ id: 'novel', noveltyLevel: 'high', category: 'industry_news' });

    const ranked = rankInsights([obviousButRelevant, nicheButNovel], {
      weights: baseWeights,
      categoryRelevanceWeights: { software_engineering: 0.9, industry_news: 0.1 },
      profileKeywords: [],
      maxInsights: 8,
    });

    expect(ranked[0]!.id).toBe('novel');
  });

  it('boosts an insight whose title/summary matches the reader profile', () => {
    const matching = insight({ id: 'matching', title: 'A tradeoff in distributed systems design' });
    const notMatching = insight({ id: 'not-matching', title: 'Something else entirely' });

    const ranked = rankInsights([matching, notMatching], {
      weights: baseWeights,
      categoryRelevanceWeights: { software_engineering: 1 },
      profileKeywords: ['distributed systems'],
      maxInsights: 8,
    });

    expect(ranked[0]!.id).toBe('matching');
  });
});

describe('estimateReadingMinutes', () => {
  it('is zero for no insights', () => {
    expect(estimateReadingMinutes(0)).toBe(0);
  });

  it('lands in the spec-second.md 3-5 minute target for a typical 8-insight briefing', () => {
    expect(estimateReadingMinutes(8)).toBeGreaterThanOrEqual(3);
    expect(estimateReadingMinutes(8)).toBeLessThanOrEqual(5);
  });
});
