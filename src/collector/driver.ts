import type { Page } from 'playwright';
import { EXTRACT_POSTS_SNIPPET, type ExtractedPost } from './extractSnippet';

/**
 * The subset of browser control the live collector loop (`scroller.ts`) needs, kept as an
 * interface so the loop's orchestration logic (stop conditions, checkpoint pausing, dedup,
 * screenshots) can be unit tested against a fake instead of a real browser — collector tests
 * otherwise use saved HTML fixtures only (grill J9). `createPlaywrightDriver` is the real,
 * Chrome-backed implementation and is not itself unit tested, same as `browser.ts`.
 */
export interface CollectorDriver {
  url(): string;
  extractPosts(): Promise<ExtractedPost[]>;
  /** Screenshots the post tagged `data-fd-idx="idx"` to `filePath`. Returns false if the element is gone. */
  screenshotElement(idx: number, filePath: string): Promise<boolean>;
  scrollBy(px: number): Promise<void>;
  wait(ms: number): Promise<void>;
}

export function createPlaywrightDriver(page: Page): CollectorDriver {
  return {
    url: () => page.url(),

    extractPosts: () => page.evaluate(EXTRACT_POSTS_SNIPPET),

    async screenshotElement(idx, filePath) {
      const locator = page.locator(`[data-fd-idx="${idx}"]`).first();
      if ((await locator.count()) === 0) return false;
      try {
        await locator.screenshot({ path: filePath });
        return true;
      } catch {
        return false;
      }
    },

    // A wheel event reads as a real scroll gesture rather than a script-driven jump — grill
    // B2/Q5 ("realistic viewport... slow randomized scrolling", no stealth needed for this,
    // just not looking like a script).
    scrollBy: (px) => page.mouse.wheel(0, px),

    wait: (ms) => page.waitForTimeout(ms),
  };
}
