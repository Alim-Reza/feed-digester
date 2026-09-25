import { describe, expect, it } from 'vitest';
import { normalizeSkills } from './skillAliases';

describe('normalizeSkills', () => {
  it('maps a known alias case-insensitively', () => {
    expect(normalizeSkills(['k8s', 'K8S', ' k8s '], { k8s: 'Kubernetes' })).toEqual([
      'Kubernetes',
      'Kubernetes',
      'Kubernetes',
    ]);
  });

  it('keeps an unknown skill as written, trimmed', () => {
    expect(normalizeSkills([' Rust '], { k8s: 'Kubernetes' })).toEqual(['Rust']);
  });

  it('drops empty entries', () => {
    expect(normalizeSkills(['', '  ', 'Go'], {})).toEqual(['Go']);
  });
});
