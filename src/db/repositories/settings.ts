import { eq } from 'drizzle-orm';
import type { DbClient } from '../client';
import { settings } from '../schema';

export function createSettingsRepository(db: DbClient) {
  return {
    get(key: string): unknown | undefined {
      return db.select().from(settings).where(eq(settings.key, key)).get()?.value;
    },

    set(key: string, value: unknown): void {
      db.insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } })
        .run();
    },

    getAll(): Record<string, unknown> {
      const rows = db.select().from(settings).all();
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
