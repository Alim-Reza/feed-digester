import type { ClassificationResult } from './types';

export type LabeledExample = {
  trueCategories: Set<string>;
  trueRelevance: number;
  predicted: ClassificationResult;
};

export type CategoryMetrics = {
  category: string;
  precision: number;
  recall: number;
  f1: number;
  /** How many labeled examples actually belong to this category — a metric on 1-2 examples isn't trustworthy. */
  support: number;
};

/** Precision/recall/F1 per category — ADR 0003's bake-off metric. A category is "predicted" when its score clears `threshold`. */
export function computeCategoryMetrics(
  examples: readonly LabeledExample[],
  categoryIds: readonly string[],
  threshold: number,
): CategoryMetrics[] {
  return categoryIds.map((category) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let support = 0;
    for (const ex of examples) {
      const predicted = (ex.predicted.categories[category] ?? 0) >= threshold;
      const actual = ex.trueCategories.has(category);
      if (actual) support += 1;
      if (predicted && actual) tp += 1;
      else if (predicted && !actual) fp += 1;
      else if (!predicted && actual) fn += 1;
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { category, precision, recall, f1, support };
  });
}

/** Pearson correlation between predicted and labeled relevance — ADR 0003's "relevance correlation". */
export function pearsonCorrelation(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (denomX === 0 || denomY === 0) return 0;
  return numerator / Math.sqrt(denomX * denomY);
}
