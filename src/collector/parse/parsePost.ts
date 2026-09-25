import * as cheerio from 'cheerio';
import { selectors } from './selectors';
import { publishedAtFromRelativeText, publishedAtFromUrn } from './time';
import { normalizedContentHash } from './hash';
import type { PostContentType, PublishedAtPrecision } from '../../db/schema';

export type PostDraft = {
  externalId: string | null;
  hash: string;
  url: string | null;
  authorName: string;
  authorHeadline: string | null;
  viaName: string | null;
  content: string;
  contentType: PostContentType;
  publishedAt: Date | null;
  publishedAtPrecision: PublishedAtPrecision | null;
  isSponsored: boolean;
  isConnectionSuggestion: boolean;
  isPoll: boolean;
  /** True if a "see more" toggle is present, i.e. the captured text may be truncated. */
  hasMoreText: boolean;
  /** Present when parsing failed to find even a minimal author/text pair. */
  parseError: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cheerio's Cheerio<T> is invariant enough that shared helpers need `any` here.
type AnyCheerio = cheerio.Cheerio<any>;

function normText(t: string): string {
  return t.replace(/\s+/g, ' ').trim();
}

/** aria-label reads "Hide post by <Name>" or "Open control menu for post by <Name>". */
function extractAuthorName($: cheerio.CheerioAPI, root: AnyCheerio): string {
  let name: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cheerio doesn't export a stable per-node type here.
  root.find('[aria-label]').each((_: number, el: any) => {
    if (name) return;
    const label = $(el).attr('aria-label') ?? '';
    const match =
      selectors.hidePostButtonLabel.exec(label) ?? selectors.postControlMenuLabel.exec(label);
    if (match) name = match[1].trim();
  });
  return name ?? '';
}

/**
 * Best-effort: the first <p> in the actor block that isn't the author name, the "•
 * Following" status, or the relative timestamp — stopping once we reach the post's own
 * text paragraph. Matches the one real structure this was built against; may need
 * correcting once more real fixtures are captured.
 */
function extractHeadline(
  $: cheerio.CheerioAPI,
  root: AnyCheerio,
  authorName: string,
): string | null {
  const paragraphs = root.find('p').toArray();
  for (const p of paragraphs) {
    const $p = $(p);
    if ($p.find(selectors.postText).length > 0 || $p.is(selectors.postText)) break;
    const t = normText($p.text());
    if (!t) continue;
    if (t.toLowerCase() === authorName.toLowerCase()) continue;
    if (t.startsWith('•')) continue;
    if (selectors.relativeTimePattern.test(t)) continue;
    if (selectors.socialProofPattern.test(t)) continue;
    if (selectors.repostedTextPattern.test(t)) continue;
    return t;
  }
  return null;
}

function extractTimestampText($: cheerio.CheerioAPI, root: AnyCheerio): string {
  for (const p of root.find('p').toArray()) {
    const t = normText($(p).text());
    if (selectors.relativeTimePattern.test(t) || /just now/i.test(t)) return t;
  }
  return '';
}

/** Text of the container with the post's own text removed, so via/sponsored checks don't match inside post content. */
function outsidePostText($: cheerio.CheerioAPI, root: AnyCheerio): string {
  const clone = root.clone();
  clone.find(selectors.postText).remove();
  return normText(clone.text());
}

function extractOpportunisticUrn(html: string): {
  externalId: string | null;
  exactPublishedAt: Date | null;
} {
  const match = selectors.nestedCommentActivityId.exec(html);
  if (!match) return { externalId: null, exactPublishedAt: null };
  try {
    const id = BigInt(match[1]);
    const externalId = `urn:li:activity:${id.toString()}`;
    return { externalId, exactPublishedAt: publishedAtFromUrn(externalId) };
  } catch {
    return { externalId: null, exactPublishedAt: null };
  }
}

function activityUrl(urn: string | null): string | null {
  return urn ? `https://www.linkedin.com/feed/update/${urn}/` : null;
}

/** `<video>` presence is a confident signal; image/poll/article/document detection needs more real examples to calibrate safely (an avatar `<img>` is present on every post, so guessing at "content image" markup risks false-positiving every single post). */
function detectContentType(root: AnyCheerio): PostContentType {
  return root.find('video').length > 0 ? 'video' : 'text';
}

/**
 * Parses one post's sanitized outerHTML into a `PostDraft`. Pure — no DOM, no network —
 * so it's testable against saved fixtures (plan slice 3). Never throws: a post whose shape
 * doesn't match the expected selectors comes back with `parseError` set instead, so a single
 * bad fixture/markup change can't crash the whole collection run.
 */
export function parsePost(html: string, now: Date = new Date()): PostDraft {
  const $ = cheerio.load(html);
  // cheerio wraps a bare fragment in <html><body>...</body></html>; the post's own outer
  // div is body's first child, not $.root()'s (which would be <html> itself).
  const root = $('body').children().first();

  const authorName = extractAuthorName($, root);
  const authorHeadline = extractHeadline($, root, authorName);
  const content = normText(root.find(selectors.postText).text());
  const hasMoreText = root.find(selectors.seeMoreButton).length > 0;

  const outsideText = outsidePostText($, root);
  const isSponsored = selectors.sponsoredText.test(outsideText);
  const isConnectionSuggestion = selectors.connectionSuggestionText.test(root.text());
  const viaMatch = selectors.repostedTextPattern.exec(outsideText);
  const viaName = viaMatch ? viaMatch[1].trim() : null;

  const contentType = detectContentType(root);
  const isPoll = contentType === 'poll';

  const { externalId, exactPublishedAt } = extractOpportunisticUrn(html);
  const timestampText = extractTimestampText($, root);
  const estimatedPublishedAt = exactPublishedAt
    ? null
    : publishedAtFromRelativeText(timestampText, now);
  const publishedAt = exactPublishedAt ?? estimatedPublishedAt;
  const publishedAtPrecision: PublishedAtPrecision | null = exactPublishedAt
    ? 'exact'
    : estimatedPublishedAt
      ? 'estimated'
      : null;

  const parseError = !authorName && !content ? 'no author name or post text found' : null;

  return {
    externalId,
    hash: normalizedContentHash(authorName, content),
    url: activityUrl(externalId),
    authorName,
    authorHeadline,
    viaName,
    content,
    contentType,
    publishedAt,
    publishedAtPrecision,
    isSponsored,
    isConnectionSuggestion,
    isPoll,
    hasMoreText,
    parseError,
  };
}
