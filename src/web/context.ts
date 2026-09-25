import { loadConfig } from '../config';
import { loadSettingsOverrides } from '../config/settingsOverrides';
import { createDb, type DbClient } from '../db/client';
import { runMigrations } from '../db/migrate';
import { createRepositories, type Repositories } from '../db/repositories';
import type { DigestConfig } from '../config/schema';

type WebContext = { db: DbClient; repos: Repositories; config: DigestConfig };

const globalForDb = globalThis as unknown as { __feedDigesterWebContext?: WebContext };

/**
 * One DB connection for the whole `web` process. Next.js can hot-reload modules in dev, so this
 * is cached on `globalThis` (the same trick a Prisma client singleton uses) instead of opening a
 * new better-sqlite3 handle on every reload. `web` only ever reads and enqueues `run_commands`
 * — it never writes pipeline data (CLAUDE.md's ground rule); every write in `app/` goes through
 * `repos.runCommands`, nothing else.
 */
export function getWebContext(): WebContext {
  if (!globalForDb.__feedDigesterWebContext) {
    const db = createDb(loadConfig().dataDir);
    runMigrations(db);
    const repos = createRepositories(db);
    const config = loadConfig(loadSettingsOverrides(repos));
    globalForDb.__feedDigesterWebContext = { db, repos, config };
  }
  return globalForDb.__feedDigesterWebContext;
}
