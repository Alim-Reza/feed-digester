import { describe, expect, it } from 'vitest';
import { detectLanguage, isLanguageAllowed } from './detect';

describe('detectLanguage', () => {
  it('recognizes English', () => {
    expect(detectLanguage('This is a simple English sentence for testing purposes today.')).toBe(
      'en',
    );
  });

  it('recognizes Bangla', () => {
    expect(detectLanguage('আমি বাংলায় গান গাই এবং কবিতা লিখি প্রতিদিন সকালে।')).toBe('bn');
  });

  it('recognizes a third language as neither en nor bn', () => {
    const french = detectLanguage(
      "Ceci est une phrase en français pour tester la détection de langue aujourd'hui.",
    );
    expect(['en', 'bn']).not.toContain(french);
  });

  it('treats undetectably short text as English rather than dropping it', () => {
    expect(detectLanguage('hi')).toBe('en');
    expect(detectLanguage('')).toBe('en');
  });
});

describe('isLanguageAllowed', () => {
  const allowed = ['en', 'bn'];

  it('allows English and Bangla', () => {
    expect(
      isLanguageAllowed('This is an English sentence about software engineering.', allowed),
    ).toBe(true);
    expect(isLanguageAllowed('আমি বাংলায় গান গাই এবং কবিতা লিখি প্রতিদিন সকালে।', allowed)).toBe(
      true,
    );
  });

  it('disallows a language not in the list', () => {
    expect(
      isLanguageAllowed(
        "Ceci est une phrase en français pour tester la détection de langue aujourd'hui.",
        allowed,
      ),
    ).toBe(false);
  });
});
