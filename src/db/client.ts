import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Opens the SQLite database in WAL mode (so `web` can read while `worker` writes,
 * per ADR 0002) with foreign keys enforced. Callers own the returned client's lifetime.
 */
export function createDb(dataDir: string, filename = 'feed-digester.sqlite'): DbClient {
  fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(path.join(dataDir, filename));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}
