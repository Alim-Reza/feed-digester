/** Unicode letters plus combining marks — Bangla vowel signs and the virama are `\p{M}`, not `\p{L}`, so counting letters alone undercounts real Bangla text as noise. */
const LETTER_LIKE = /[\p{L}\p{M}]/gu;

/**
 * OCR on a screenshot of a LinkedIn post is noisy — a photo, a logo-only graphic, or a blank
 * area produces short garbage strings rather than an error. This is a cheap heuristic for
 * "does this look like real text", not a language model: enough letters relative to noise, and
 * at least a few real words. Grill C5: if the OCR text passes, the image is kept; if not, it's
 * discarded.
 */
export function looksLikeRealText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 15) return false;

  const nonSpace = trimmed.replace(/\s/gu, '');
  if (nonSpace.length === 0) return false;
  const letters = nonSpace.match(LETTER_LIKE)?.length ?? 0;
  if (letters / nonSpace.length < 0.6) return false;

  const realWords = trimmed
    .split(/\s+/u)
    .filter((word) => (word.match(LETTER_LIKE)?.length ?? 0) >= 3);
  return realWords.length >= 3;
}
