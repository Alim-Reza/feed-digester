import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { chromium, type BrowserContext } from 'playwright';

/** Chrome profiles live outside the repo so they never risk being committed. */
export function profileDir(
  profileName: string,
  baseDir = path.join(os.homedir(), '.feed-digester', 'profiles'),
): string {
  return path.join(baseDir, profileName);
}

/**
 * Opens the given persistent Chrome profile, headed, using the machine's installed Chrome
 * (not Playwright's bundled Chromium) — see plan §2.1. Caller owns closing the context.
 */
export async function openProfile(profileName: string): Promise<BrowserContext> {
  const userDataDir = profileDir(profileName);
  fs.mkdirSync(userDataDir, { recursive: true });
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
}
