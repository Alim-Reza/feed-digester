import { cosineSimilarity } from './similarity';

export type EmbeddedItem = { id: string; embedding: number[] };

export type Cluster = {
  members: string[];
  centroid: number[];
  /** Average member-to-centroid cosine similarity — how tight the topic actually is. */
  cohesion: number;
};

function meanVector(vectors: readonly number[][]): number[] {
  const dim = vectors[0]!.length;
  const sum = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i += 1) sum[i] += v[i]!;
  }
  return sum.map((s) => s / vectors.length);
}

/**
 * Greedy single-pass clustering (grill H1: topics are themes within a category; H2: recomputed
 * fresh for every digest, so a lightweight single pass over a modest post count is enough —
 * no need for a heavier algorithm that persists cluster identity across runs).
 *
 * Each item joins the most similar existing cluster if that similarity clears `threshold`, else
 * starts a new one; the centroid is the running mean of its members' embeddings. `threshold`
 * does double duty as both the merge decision and, via the resulting cluster's `cohesion`, the
 * viability score `thresholds.clusterScore` gates against downstream — a cluster is only ever
 * as tight as the bar that built it.
 */
export function clusterBySimilarity(items: readonly EmbeddedItem[], threshold: number): Cluster[] {
  const working: { members: string[]; embeddings: number[][]; centroid: number[] }[] = [];

  for (const item of items) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < working.length; i += 1) {
      const score = cosineSimilarity(item.embedding, working[i]!.centroid);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0 && bestScore >= threshold) {
      const cluster = working[bestIndex]!;
      cluster.members.push(item.id);
      cluster.embeddings.push(item.embedding);
      cluster.centroid = meanVector(cluster.embeddings);
    } else {
      working.push({ members: [item.id], embeddings: [item.embedding], centroid: item.embedding });
    }
  }

  return working.map((c) => ({
    members: c.members,
    centroid: c.centroid,
    cohesion:
      c.embeddings.length === 1
        ? 1
        : c.embeddings.reduce((acc, v) => acc + cosineSimilarity(v, c.centroid), 0) / c.embeddings.length,
  }));
}

/** The `limit` members most representative of the cluster (highest similarity to centroid) — used for citation sources. */
export function representativeMembers(
  cluster: Cluster,
  embeddingById: ReadonlyMap<string, number[]>,
  limit: number,
): string[] {
  return [...cluster.members]
    .sort(
      (a, b) =>
        cosineSimilarity(embeddingById.get(b)!, cluster.centroid) -
        cosineSimilarity(embeddingById.get(a)!, cluster.centroid),
    )
    .slice(0, limit);
}
