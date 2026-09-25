import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testHelpers';
import { createSettingsRepository, type SettingsRepository } from './settings';

let repo: SettingsRepository;

beforeEach(() => {
  repo = createSettingsRepository(createTestDb());
});

describe('settingsRepository', () => {
  it('returns undefined for a missing key', () => {
    expect(repo.get('thresholds')).toBeUndefined();
  });

  it('sets and gets a JSON value', () => {
    repo.set('thresholds', { relevance: 0.5 });
    expect(repo.get('thresholds')).toEqual({ relevance: 0.5 });
  });

  it('overwrites an existing key', () => {
    repo.set('thresholds', { relevance: 0.5 });
    repo.set('thresholds', { relevance: 0.7 });
    expect(repo.get('thresholds')).toEqual({ relevance: 0.7 });
  });

  it('lists all settings', () => {
    repo.set('a', 1);
    repo.set('b', 2);
    expect(repo.getAll()).toEqual({ a: 1, b: 2 });
  });
});
