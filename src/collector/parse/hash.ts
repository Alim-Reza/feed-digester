import { createHash } from 'node:crypto';

/** Dedup key for posts with no URN: a hash of normalized author + text (plan §3.4). */
export function normalizedContentHash(authorName: string, content: string): string {
  const normalized = `${authorName.trim().toLowerCase()}::${content.trim().toLowerCase().replace(/\s+/g, ' ')}`;
  return createHash('sha256').update(normalized).digest('hex');
}
