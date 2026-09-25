import { francAll } from 'franc';

/** Maps franc's ISO 639-3 codes to the two-letter codes `digest.config.ts` uses. */
const ISO_639_3_TO_CONFIG: Record<string, string> = { eng: 'en', ben: 'bn' };

/**
 * How close a candidate's score has to be to the top-ranked candidate's score to still count
 * (relative to the top score, not absolute — franc's scores aren't on a fixed scale).
 * `franc`'s single top guess (what its `franc()` function returns) is unreliable on short or
 * ambiguous English text — e.g. "A substantive post about distributed systems and how we
 * scaled our queue." comes back top-ranked as French, with English a close second. Genuinely
 * non-English/non-Bangla text (checked empirically against real French/Spanish samples) scores
 * `'eng'`/`'ben'` far below its top candidate, well under this threshold — so checking the
 * *full* ranked list for a close-enough match, instead of trusting only the #1 guess, avoids
 * false-positive drops of real English content while still catching actual foreign-language
 * posts (grill C12).
 */
const CLOSE_ENOUGH_RATIO = 0.8;

/**
 * Detects a post's language from its text (post content plus any OCR text), mapped down to
 * the codes `digest.config.ts`'s `filtering.allowedLanguages` uses. Too little text to say
 * anything (`franc` returns `'und'`, undetermined) is treated as English rather than as
 * "unknown language", since assuming a short post is foreign would be a worse mistake than
 * assuming it's English — grill C12 is about actual non-English content, not uncertainty from
 * too little text.
 */
export function detectLanguage(text: string): string {
  const candidates = francAll(text, { minLength: 10 });
  const topScore = candidates[0]?.[1] ?? 0;
  if (candidates[0]?.[0] === 'und' || topScore === 0) return 'en';

  for (const [iso639_3, config] of Object.entries(ISO_639_3_TO_CONFIG)) {
    const match = candidates.find(([code]) => code === iso639_3);
    if (match && match[1] / topScore >= CLOSE_ENOUGH_RATIO) return config;
  }
  return ISO_639_3_TO_CONFIG[candidates[0][0]] ?? candidates[0][0];
}

/** Whether the detected language is one `digest.config.ts` allows through the filter. */
export function isLanguageAllowed(text: string, allowedLanguages: readonly string[]): boolean {
  return allowedLanguages.includes(detectLanguage(text));
}
