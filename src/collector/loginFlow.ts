import { openProfile } from './browser';
import type { DigestConfig } from '../config/schema';
import type { Logger } from '../logging';

const FEED_URL = 'https://www.linkedin.com/feed/';

/**
 * The "Log in" flow (`run_commands` type `'login'`, plan slice 4): opens a real, headed
 * Chrome window on the active profile (`config.profiles.active`) and waits until you close it.
 * It doesn't scroll or read anything — this exists purely so you can sign in, or solve a
 * checkpoint, by hand once. The persistent profile (`src/collector/browser.ts`) then stays
 * signed in for every later collector run on that profile.
 */
export async function runLoginFlow(config: DigestConfig, logger: Logger): Promise<void> {
  const profileName = config.profiles.active;
  logger.info({ profile: profileName }, 'login: opening browser');
  const context = await openProfile(profileName);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(FEED_URL);

  await new Promise<void>((resolve) => {
    context.on('close', () => resolve());
  });
  logger.info({ profile: profileName }, 'login: browser closed');
}
