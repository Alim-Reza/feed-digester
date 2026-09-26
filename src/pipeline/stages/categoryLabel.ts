import type { DigestConfig } from '../../config/schema';

export function categoryLabelFor(config: DigestConfig, category: string): string {
  return config.categories.find((c) => c.id === category)?.label ?? category;
}
