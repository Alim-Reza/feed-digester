import { createHash } from 'node:crypto';
import { sanitizePostHtml } from './sanitize';

export type CapturedPost = { urn: string | null; html: string };

/** Stable id for a captured post: the URN when present, else a hash of the sanitized HTML. */
export function fixtureId(post: CapturedPost): string {
  if (post.urn) return post.urn.replace(/[^a-zA-Z0-9_-]/g, '_');
  return createHash('sha256').update(post.html).digest('hex').slice(0, 16);
}

/** Given already-seen ids, returns only the posts (sanitized, deduped by id) worth writing to disk. */
export function selectNewFixtures(
  posts: CapturedPost[],
  seenIds: ReadonlySet<string>,
): { id: string; html: string }[] {
  const result: { id: string; html: string }[] = [];
  const seenThisBatch = new Set<string>();
  for (const post of posts) {
    const id = fixtureId(post);
    if (seenIds.has(id) || seenThisBatch.has(id)) continue;
    seenThisBatch.add(id);
    result.push({ id, html: sanitizePostHtml(post.html) });
  }
  return result;
}
