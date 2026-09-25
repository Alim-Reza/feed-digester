import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { DbClient } from './client';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export function runMigrations(db: DbClient): void {
  migrate(db, { migrationsFolder: path.join(dirname, 'migrations') });
}
