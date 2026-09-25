import { describe, expect, it } from 'vitest';
import { loadConfig } from './index';

describe('loadConfig', () => {
  it('validates the typed defaults', () => {
    const config = loadConfig();
    expect(config.categories.length).toBe(6);
    expect(config.categories.map((c) => c.id)).toContain('software_engineering');
    expect(config.thresholds.relevance).toBeGreaterThan(0);
  });

  it('is frozen', () => {
    const config = loadConfig();
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('applies deep overrides without losing sibling fields', () => {
    const config = loadConfig({ thresholds: { relevance: 0.9 } });
    expect(config.thresholds.relevance).toBe(0.9);
    expect(config.thresholds.job).toBeGreaterThan(0);
  });

  it('reads DATA_DIR from the environment', () => {
    const previous = process.env.DATA_DIR;
    process.env.DATA_DIR = '/tmp/custom-data-dir';
    try {
      const config = loadConfig();
      expect(config.dataDir).toBe('/tmp/custom-data-dir');
    } finally {
      if (previous === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previous;
    }
  });
});
