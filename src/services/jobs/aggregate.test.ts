import { describe, expect, it } from 'vitest';
import { aggregateJobMarket, buildJobOpeningViews } from './aggregate';
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

const emptyProfile = { interests: [], goals: [], alreadyFamiliarWith: [] };

describe('buildJobOpeningViews', () => {
  it('joins url/authorName from the post source map (spec-second.md §8)', () => {
    const rows = [row({ postId: 'p1' })];
    const source = new Map([['p1', { url: 'https://example.com/post', authorName: 'A Recruiter' }]]);

    const views = buildJobOpeningViews(rows, source, emptyProfile);

    expect(views[0]).toMatchObject({ url: 'https://example.com/post', authorName: 'A Recruiter' });
  });

  it('stays silent on whyRelevant/skillGaps when the profile is empty, never guessing', () => {
    const rows = [row({ postId: 'p1' })];
    const views = buildJobOpeningViews(rows, new Map(), emptyProfile);

    expect(views[0]!.whyRelevant).toBeNull();
    expect(views[0]!.skillGaps).toEqual([]);
  });

  it('flags why a role is relevant when it matches a configured interest', () => {
    const rows = [row({ postId: 'p1', role: 'Distributed Systems Engineer', skills: ['Go'] })];
    const profile = { interests: ['distributed systems'], goals: [], alreadyFamiliarWith: [] };

    const views = buildJobOpeningViews(rows, new Map(), profile);

    expect(views[0]!.whyRelevant).toMatch(/distributed systems/);
  });

  it('never invents a missing field — an unmatched job just gets no whyRelevant', () => {
    const rows = [row({ postId: 'p1', role: 'Marketing Manager', skills: [] })];
    const profile = { interests: ['distributed systems'], goals: [], alreadyFamiliarWith: [] };

    const views = buildJobOpeningViews(rows, new Map(), profile);

    expect(views[0]!.whyRelevant).toBeNull();
  });

  it('computes skill gaps as skills not already listed as familiar', () => {
    const rows = [row({ postId: 'p1', skills: ['Go', 'Kubernetes'] })];
    const profile = { interests: [], goals: [], alreadyFamiliarWith: ['Go'] };

    const views = buildJobOpeningViews(rows, new Map(), profile);

    expect(views[0]!.skillGaps).toEqual(['Kubernetes']);
  });
});
