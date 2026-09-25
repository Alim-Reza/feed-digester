/**
 * Runs the "Log in" flow directly (plan slice 4): opens a real, headed Chrome window on the
 * active profile (`config.profiles.active` — "main" or "collector") and waits until you close
 * it. Use this once per profile to sign in by hand; the persistent profile then stays signed
 * in for every later collector run. Once slice 11's operations UI lands, this becomes a
 * `run_commands` row the worker picks up instead — this script calls the same `runLoginFlow`
 * directly, without needing the worker running.
 *
 * Usage: pnpm login
 */
import { loadConfig } from '../src/config';
import { createLogger } from '../src/logging';
import { runLoginFlow } from '../src/collector/loginFlow';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config, 'login');
  console.log(`Opening Chrome on profile "${config.profiles.active}"...`);
  console.log('Log in, then close the window when you are done.');
  await runLoginFlow(config, logger);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
