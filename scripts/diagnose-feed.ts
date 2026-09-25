/**
 * One-off diagnostic tool, not part of the permanent pipeline. `page.content()` only
 * serializes light DOM, so if LinkedIn renders feed posts inside shadow roots or iframes
 * (which the first capture-fixtures.ts run suggests it now does), a plain HTML snapshot
 * comes back empty even though posts are visibly on screen. This walks every frame and
 * composes shadow DOM inline, so the real structure can actually be inspected.
 *
 * Usage: pnpm diagnose:feed [profileName]
 */
import path from 'node:path';
import fs from 'node:fs';
import { openProfile } from '../src/collector/browser';
import { COMPOSED_SERIALIZE_SNIPPET } from '../src/collector/composedSerializer';

const OUT_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'linkedin');

async function main() {
  const profileName = process.argv[2] ?? 'collector';
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Opening Chrome on profile "${profileName}"...`);
  const context = await openProfile(profileName);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('https://www.linkedin.com/feed/');

  console.log('Waiting 8s for the feed to load — make sure you are logged in and on /feed...');
  await page.waitForTimeout(8000);

  const frames = page.frames();
  console.log(`Found ${frames.length} frame(s).`);

  let index = 0;
  for (const frame of frames) {
    index += 1;
    let url = '(unknown)';
    try {
      url = frame.url();
    } catch {
      // ignore
    }
    console.log(`  frame ${index}: ${url}`);
    try {
      const html = await frame.evaluate(COMPOSED_SERIALIZE_SNIPPET);
      const slug = url.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 60);
      const outPath = path.join(OUT_DIR, `_debug-composed-frame-${index}-${slug}.html`);
      fs.writeFileSync(outPath, String(html), 'utf8');
      console.log(
        `    -> saved ${path.relative(process.cwd(), outPath)} (${String(html).length} bytes)`,
      );
    } catch (err) {
      console.log(`    -> could not evaluate in this frame: ${(err as Error).message}`);
    }
  }

  console.log('\nDone. Closing browser.');
  await context.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
