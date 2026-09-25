/**
 * Manual fixture-capture mode (plan slice 3). Opens a real, headed Chrome window on your
 * chosen persistent profile so you can log in and scroll LinkedIn's feed yourself. While
 * that window is open, this script polls the DOM every few seconds, sanitizes each new post
 * it finds, and writes it to tests/fixtures/linkedin/ — these become the parser test fixtures.
 *
 * This does not scroll, click, or interact with the page for you — it only reads. You log
 * in and scroll; it watches. Stop it any time with Ctrl+C.
 *
 * Usage: pnpm collect:fixtures [profileName]   (defaults to the "collector" profile)
 */
import path from 'node:path';
import fs from 'node:fs';
import { openProfile } from '../src/collector/browser';
import { COMPOSED_SERIALIZE_SNIPPET } from '../src/collector/composedSerializer';
import { selectNewFixtures, type CapturedPost } from '../src/collector/fixtureCapture';

const POLL_INTERVAL_MS = 3000;
const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'linkedin');

/**
 * Real posts render as `[role="listitem"]`, but so do other things (comments, nav
 * carousels) — a real post also has post text or a "Hide post by"/"Open control menu for
 * post by" control. Comments can themselves be nested `[role="listitem"]`s inside a post,
 * so this keeps only the outermost matching element per post rather than double-capturing.
 * Runs in the page; no shadow-DOM piercing needed here — Playwright's own selector engine
 * (and plain `outerHTML`) already reaches almost all of the real feed content (confirmed via
 * `scripts/diagnose-feed.ts`).
 */
const EXTRACT_POSTS_SNIPPET = `
  (function () {
    const isPostLabel = (label) => /^(Hide post by |Open control menu for post by )/i.test(label || '');
    const candidates = Array.from(document.querySelectorAll('[role="listitem"]')).filter((el) => {
      if (el.querySelector('[data-testid="expandable-text-box"]')) return true;
      return Array.from(el.querySelectorAll('[aria-label]')).some((n) => isPostLabel(n.getAttribute('aria-label')));
    });
    const outermost = candidates.filter((el) => !candidates.some((other) => other !== el && other.contains(el)));
    return outermost.map((el) => ({ urn: null, html: el.outerHTML }));
  })()
`;

async function main() {
  const profileName = process.argv[2] ?? 'collector';
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  console.log(`Opening Chrome on profile "${profileName}"...`);
  const context = await openProfile(profileName);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('https://www.linkedin.com/feed/');

  console.log('');
  console.log('Log in if this profile is not already signed in, then scroll the feed');
  console.log('naturally — new posts you scroll past get saved as fixtures automatically.');
  console.log(`Fixtures are written to ${path.relative(process.cwd(), FIXTURES_DIR)}/`);
  console.log('Press Ctrl+C here when you have enough (aim for 30+ varied posts).');
  console.log('');

  const seenIds = new Set<string>(
    fs.existsSync(FIXTURES_DIR)
      ? fs
          .readdirSync(FIXTURES_DIR)
          .filter((f) => f.endsWith('.html') && !f.startsWith('_'))
          .map((f) => f.replace(/\.html$/, ''))
      : [],
  );
  let warnedNoMatches = false;
  let printedWaitingForLogin = false;
  let saved = 0;

  const tick = async () => {
    let url = '';
    try {
      url = page.url();
    } catch {
      return; // page/context closed
    }
    const onFeed = url.includes('/feed');
    if (!onFeed) {
      if (!printedWaitingForLogin) {
        printedWaitingForLogin = true;
        console.log('Waiting for you to log in and reach your feed...');
      }
      return;
    }
    printedWaitingForLogin = false;

    let posts: CapturedPost[];
    try {
      posts = await page.evaluate(EXTRACT_POSTS_SNIPPET);
    } catch {
      posts = []; // page mid-navigation or closed; just skip this tick
    }

    // Only warn once we're actually on the feed and still finding nothing — before that,
    // zero matches just means the login page hasn't loaded posts yet, which is expected.
    if (posts.length === 0 && !warnedNoMatches) {
      warnedNoMatches = true;
      console.warn(
        "[warn] On your feed but no posts matched. LinkedIn's markup has likely changed " +
          'again — update src/collector/parse/selectors.ts. Saving a composed debug snapshot ' +
          '(shadow DOM inlined) for reference; run `pnpm diagnose:feed` for a full per-frame dump.',
      );
      try {
        const html = await page.evaluate(COMPOSED_SERIALIZE_SNIPPET);
        fs.writeFileSync(
          path.join(FIXTURES_DIR, '_debug-page-snapshot.html'),
          String(html),
          'utf8',
        );
      } catch {
        // best-effort only
      }
    }

    const fresh = selectNewFixtures(posts, seenIds);
    for (const fixture of fresh) {
      fs.writeFileSync(path.join(FIXTURES_DIR, `${fixture.id}.html`), fixture.html, 'utf8');
      seenIds.add(fixture.id);
      saved += 1;
    }
    if (fresh.length > 0) {
      console.log(`Saved ${fresh.length} new post(s) — ${saved} total this session.`);
    }
  };

  const timer = setInterval(() => {
    tick().catch((err) => console.error('[error] capture tick failed:', err));
  }, POLL_INTERVAL_MS);

  const shutdown = async () => {
    clearInterval(timer);
    console.log(
      `\nDone. Saved ${saved} new fixture(s) to ${path.relative(process.cwd(), FIXTURES_DIR)}/.`,
    );
    await context.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
