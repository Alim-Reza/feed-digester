/**
 * ADR 0003's fix for gemma4's own relevance number (bake-off finding: badly calibrated, far
 * too generous — 65/101 posts scored >=0.8, versus Laya's 1/101). Instead of trusting an LLM's
 * unconstrained "how relevant is this" guess, relevance is derived deterministically from its
 * own per-category confidence scores, weighted by how much the reader cares about each
 * category (`config.classification.relevanceWeights`). Weights are normalized by their sum, so
 * config doesn't need to keep them summing to exactly 1.
 */
export function computeWeightedRelevance(
  categories: Record<string, number>,
  weights: Record<string, number>,
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [category, weight] of Object.entries(weights)) {
    weightedSum += (categories[category] ?? 0) * weight;
    totalWeight += weight;
  }
  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}
