import { describe, expect, it } from 'vitest';
import { cosineSimilarity } from './similarity';

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('is -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('is 0 when either vector is all zeros, instead of dividing by zero', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});
