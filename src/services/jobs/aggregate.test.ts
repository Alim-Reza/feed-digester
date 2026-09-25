import { describe, expect, it } from 'vitest';
import { aggregateJobMarket } from './aggregate';
import type { JobOpeningRow } from '../../db/repositories/jobOpenings';

function row(overrides: Partial<JobOpeningRow> = {}): JobOpeningRow {
  return {
    id: 'j1',
    postId: 'p1',
    company: 'Acme',
    role: 'Engineer',
    location: 'Remote',
    remoteStatus: 'remote',
    seniority: 'senior',
    experience: '5+ years',
    skills: ['Go', 'Kubernetes'],
    model: 'fake-model',
    ...overrides,
  };
}

describe('aggregateJobMarket', () => {
  it('counts occurrences per field, sorted descending, and flattens skills', () => {
    const rows = [
      row({ id: 'j1', company: 'Acme', skills: ['Go'] }),
      row({ id: 'j2', company: 'Acme', skills: ['Go', 'Kubernetes'] }),
      row({ id: 'j3', company: 'Globex', skills: ['Kubernetes'] }),
    ];

    const stats = aggregateJobMarket(rows);

    expect(stats.totalOpenings).toBe(3);
    expect(stats.companies).toEqual([
      { name: 'Acme', count: 2 },
      { name: 'Globex', count: 1 },
    ]);
    expect(stats.skills).toEqual([
      { name: 'Go', count: 2 },
      { name: 'Kubernetes', count: 2 },
    ]);
  });

  it('ignores null fields instead of counting them as a value', () => {
    const rows = [row({ location: null }), row({ location: 'Berlin' })];

    const stats = aggregateJobMarket(rows);

    expect(stats.locations).toEqual([{ name: 'Berlin', count: 1 }]);
  });

  it('returns empty aggregates for no rows', () => {
    expect(aggregateJobMarket([])).toEqual({
      totalOpenings: 0,
      companies: [],
      roles: [],
      skills: [],
      seniorities: [],
      locations: [],
    });
  });
});
