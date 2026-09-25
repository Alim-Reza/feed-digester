import { describe, expect, it } from 'vitest';
import { computeWeightedRelevance } from './relevance';

describe('computeWeightedRelevance', () => {
  it('weights each category score by its configured weight', () => {
    const relevance = computeWeightedRelevance(
      { software_engineering: 1, career: 0 },
      { software_engineering: 0.8, career: 0.2 },
    );
    // (1*0.8 + 0*0.2) / (0.8 + 0.2) = 0.8
    expect(relevance).toBeCloseTo(0.8);
  });

  it('normalizes by the sum of weights, so they need not add to 1', () => {
    const relevance = computeWeightedRelevance({ ai_ml: 1 }, { ai_ml: 3, career: 3 });
    // ai_ml has no career score (treated as 0): (1*3 + 0*3) / 6 = 0.5
    expect(relevance).toBeCloseTo(0.5);
  });

  it('treats a category missing from the scores as 0, not an error', () => {
    const relevance = computeWeightedRelevance({}, { software_engineering: 1 });
    expect(relevance).toBe(0);
  });

  it('is 0 when every weight is 0, instead of dividing by zero', () => {
    expect(computeWeightedRelevance({ ai_ml: 1 }, { ai_ml: 0 })).toBe(0);
  });

  it('ignores a weighted category with 0 weight', () => {
    const relevance = computeWeightedRelevance({ ai_ml: 1, job: 1 }, { ai_ml: 1, job: 0 });
    expect(relevance).toBeCloseTo(1);
  });
});
