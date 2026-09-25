import { describe, expect, it } from 'vitest';
import { clusterBySimilarity, representativeMembers } from './cluster';

describe('clusterBySimilarity', () => {
  it('merges near-identical items into one cluster', () => {
    const items = [
      { id: 'a', embedding: [1, 0, 0] },
      { id: 'b', embedding: [0.99, 0.01, 0] },
      { id: 'c', embedding: [0.98, 0.02, 0] },
    ];

    const clusters = clusterBySimilarity(items, 0.9);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.members).toEqual(['a', 'b', 'c']);
    expect(clusters[0]!.cohesion).toBeGreaterThan(0.9);
  });

  it('keeps dissimilar items in separate clusters', () => {
    const items = [
      { id: 'a', embedding: [1, 0, 0] },
      { id: 'b', embedding: [0, 1, 0] },
    ];

    const clusters = clusterBySimilarity(items, 0.9);

    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.members)).toEqual([['a'], ['b']]);
  });

  it('gives a singleton cluster cohesion of 1', () => {
    const clusters = clusterBySimilarity([{ id: 'a', embedding: [1, 2, 3] }], 0.5);
    expect(clusters[0]!.cohesion).toBe(1);
  });

  it('returns no clusters for no items', () => {
    expect(clusterBySimilarity([], 0.5)).toEqual([]);
  });
});

describe('representativeMembers', () => {
  it('ranks members by similarity to the cluster centroid, highest first', () => {
    const embeddingById = new Map([
      ['a', [1, 0]],
      ['b', [0.9, 0.1]],
      ['c', [0.5, 0.5]],
    ]);
    const cluster = { members: ['c', 'a', 'b'], centroid: [1, 0], cohesion: 0.8 };

    expect(representativeMembers(cluster, embeddingById, 2)).toEqual(['a', 'b']);
  });
});
