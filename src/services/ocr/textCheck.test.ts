import { describe, expect, it } from 'vitest';
import { looksLikeRealText } from './textCheck';

describe('looksLikeRealText', () => {
  it('accepts a real English sentence', () => {
    expect(looksLikeRealText('We are hiring senior backend engineers in Berlin and remote.')).toBe(
      true,
    );
  });

  it('accepts real Bangla text', () => {
    expect(looksLikeRealText('আমরা বার্লিনে সিনিয়র ব্যাকএন্ড ইঞ্জিনিয়ার নিয়োগ করছি।')).toBe(
      true,
    );
  });

  it('rejects empty or whitespace-only text', () => {
    expect(looksLikeRealText('')).toBe(false);
    expect(looksLikeRealText('   \n\t  ')).toBe(false);
  });

  it('rejects short noise', () => {
    expect(looksLikeRealText('OK')).toBe(false);
    expect(looksLikeRealText('||l l||')).toBe(false);
  });

  it('rejects a long run of symbols/noise with few letters', () => {
    expect(looksLikeRealText('!!! ### $$$ %%% ^^^ &&& *** ((( ))) ___ === +++')).toBe(false);
  });

  it('rejects text with letters but no real multi-character words (e.g. scattered single glyphs)', () => {
    expect(looksLikeRealText('a b c d e f g h i j k')).toBe(false);
  });
});
