import { describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../db/testHelpers';
import { createRepositories } from '../db/repositories';
import { loadConfig } from './index';
import { loadSettingsOverrides } from './settingsOverrides';

describe('loadSettingsOverrides', () => {
  it('returns an empty object when nothing is in the settings table', () => {
    const repos = createRepositories(createTestDb());
    expect(loadSettingsOverrides(repos)).toEqual({});
  });

  it('picks up only rows keyed by a known top-level config field', () => {
    const repos = createRepositories(createTestDb());
    repos.settings.set('thresholds', { relevance: 0.6 });
    repos.settings.set('not_a_real_config_key', { anything: true });

    const overrides = loadSettingsOverrides(repos);

    expect(overrides).toEqual({ thresholds: { relevance: 0.6 } });
  });

  it('feeds cleanly into loadConfig, merging over the file defaults', () => {
    const repos = createRepositories(createTestDb());
    repos.settings.set('thresholds', { relevance: 0.9 });

    const config = loadConfig(loadSettingsOverrides(repos));

    expect(config.thresholds.relevance).toBe(0.9);
    expect(config.thresholds.job).toBeGreaterThan(0); // untouched fields keep their default
  });

  it('drops an invalid row instead of throwing, and warns', () => {
    const repos = createRepositories(createTestDb());
    repos.settings.set('thresholds', { relevance: 'not a number' });
    const warn = vi.fn();

    const overrides = loadSettingsOverrides(repos, warn);

    expect(overrides).toEqual({});
    expect(warn).toHaveBeenCalledWith('thresholds', expect.any(String));
    // Doesn't throw when fed into loadConfig either — falls back to the file default.
    expect(loadConfig(overrides).thresholds.relevance).toBeGreaterThan(0);
  });

  it('drops a row that is out of range for its field (e.g. relevance > 1)', () => {
    const repos = createRepositories(createTestDb());
    repos.settings.set('thresholds', { relevance: 5 });
    const warn = vi.fn();

    const overrides = loadSettingsOverrides(repos, warn);

    expect(overrides).toEqual({});
    expect(warn).toHaveBeenCalledOnce();
  });
});
