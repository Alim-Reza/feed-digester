import { describe, expect, it } from 'vitest';
import { computeCategoryMetrics, pearsonCorrelation, type LabeledExample } from './evaluate';

function example(overrides: Partial<LabeledExample> = {}): LabeledExample {
  return {
    trueCategories: new Set<string>(),
    trueRelevance: 0.5,
    predicted: { categories: {}, primaryCategory: 'ai_ml', relevance: 0.5 },
    ...overrides,
  };
}

describe('computeCategoryMetrics', () => {
  it('scores perfect predictions as precision 1 / recall 1', () => {
    const examples: LabeledExample[] = [
      example({ trueCategories: new Set(['ai_ml']), predicted: { categories: { ai_ml: 0.9 }, primaryCategory: 'ai_ml', relevance: 0.9 } }),
      example({ trueCategories: new Set(), predicted: { categories: { ai_ml: 0.1 }, primaryCategory: 'career', relevance: 0.1 } }),
    ];

    const [metrics] = computeCategoryMetrics(examples, ['ai_ml'], 0.5);

    expect(metrics).toMatchObject({ category: 'ai_ml', precision: 1, recall: 1, f1: 1, support: 1 });
  });

  it('penalizes a false positive in precision without touching recall', () => {
    const examples: LabeledExample[] = [
      example({ trueCategories: new Set(), predicted: { categories: { ai_ml: 0.9 }, primaryCategory: 'ai_ml', relevance: 0.9 } }),
    ];

    const [metrics] = computeCategoryMetrics(examples, ['ai_ml'], 0.5);

    expect(metrics!.precision).toBe(0);
    expect(metrics!.support).toBe(0);
  });

  it('penalizes a false negative in recall without touching precision', () => {
    const examples: LabeledExample[] = [
      example({ trueCategories: new Set(['ai_ml']), predicted: { categories: { ai_ml: 0.1 }, primaryCategory: 'career', relevance: 0.1 } }),
    ];

    const [metrics] = computeCategoryMetrics(examples, ['ai_ml'], 0.5);

    expect(metrics!.recall).toBe(0);
    expect(metrics!.support).toBe(1);
  });

  it('returns 0 precision/recall for a category with no predictions and no support', () => {
    const [metrics] = computeCategoryMetrics([example()], ['ai_ml'], 0.5);
    expect(metrics).toMatchObject({ precision: 0, recall: 0, f1: 0, support: 0 });
  });
});

describe('pearsonCorrelation', () => {
  it('is 1 for a perfect linear relationship', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
  });

  it('is -1 for a perfect inverse relationship', () => {
    expect(pearsonCorrelation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
  });

  it('is 0 for no data or mismatched lengths', () => {
    expect(pearsonCorrelation([], [])).toBe(0);
    expect(pearsonCorrelation([1, 2], [1])).toBe(0);
  });

  it('is 0 when one series has no variance, instead of dividing by zero', () => {
    expect(pearsonCorrelation([1, 1, 1], [1, 2, 3])).toBe(0);
  });
});
