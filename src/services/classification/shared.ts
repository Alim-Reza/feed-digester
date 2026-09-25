/** Highest-scoring configured category; ties go to whichever is listed first in config. */
export function pickPrimaryCategory(
  scores: Record<string, number>,
  categories: readonly { id: string }[],
): string {
  let best = categories[0]!.id;
  let bestScore = -Infinity;
  for (const cat of categories) {
    const score = scores[cat.id] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = cat.id;
    }
  }
  return best;
}
