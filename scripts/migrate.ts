import { loadConfig } from '../src/config';
import { createDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';

const config = loadConfig();
const db = createDb(config.dataDir);
runMigrations(db);
console.log(`Migrations applied to ${config.dataDir}`);
