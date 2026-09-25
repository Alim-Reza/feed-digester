/**
 * One-off: extracts individual real post fixtures out of a composed DOM dump produced by
 * `pnpm diagnose:feed` (scripts/diagnose-feed.ts), using the same post-detection logic as
 * the live capture script. Not part of the normal workflow — `pnpm collect:fixtures` is the
 * real capture path; this just salvages real fixtures from a diagnostic dump already taken.
 *
 * Usage: tsx scripts/extract-fixtures-from-dump.ts <path-to-dump.html>
 */
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { selectNewFixtures, type CapturedPost } from '../src/collector/fixtureCapture';

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'linkedin');

function extractPosts(html: string): CapturedPost[] {
  const $ = cheerio.load(html);
  const candidates = $('[role="listitem"]')
    .toArray()
    .filter((el) => {
      const $el = $(el);
      if ($el.find('[data-testid="expandable-text-box"]').length > 0) return true;
      return $el
        .find('[aria-label]')
        .toArray()
        .some((n) =>
          /^(Hide post by |Open control menu for post by )/i.test($(n).attr('aria-label') ?? ''),
        );
    });
  const outermost = candidates.filter(
    (el) => !candidates.some((other) => other !== el && $(other).find(el).length > 0),
  );
  return outermost.map((el) => ({ urn: null, html: $.html(el) }));
}

function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('Usage: tsx scripts/extract-fixtures-from-dump.ts <path-to-dump.html>');
    process.exit(1);
  }
  const html = fs.readFileSync(dumpPath, 'utf8');
  const posts = extractPosts(html);
  console.log(`Found ${posts.length} candidate post(s) in ${dumpPath}.`);

  const seenIds = new Set(
    fs
      .readdirSync(FIXTURES_DIR)
      .filter((f) => f.endsWith('.html') && !f.startsWith('_'))
      .map((f) => f.replace(/\.html$/, '')),
  );
  const fresh = selectNewFixtures(posts, seenIds);
  for (const fixture of fresh) {
    fs.writeFileSync(path.join(FIXTURES_DIR, `${fixture.id}.html`), fixture.html, 'utf8');
  }
  console.log(
    `Wrote ${fresh.length} new real fixture(s) to ${path.relative(process.cwd(), FIXTURES_DIR)}/.`,
  );
}

main();
