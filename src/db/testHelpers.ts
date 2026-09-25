import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import type { DbClient } from './client';
import { runMigrations } from './migrate';

/** An in-memory, migrated database for tests. Never used outside `*.test.ts` files. */
export function createTestDb(): DbClient {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  runMigrations(db);
  return db;
}
