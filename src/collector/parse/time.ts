const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
  mo: 2_629_800_000, // 30.44 days, average month
  yr: 31_557_600_000, // 365.25 days, average year
};

/**
 * Decodes a post's creation time from its activity/share URN: LinkedIn's Snowflake-style ID
 * embeds a millisecond timestamp in its high bits (`id >> 22`). Plan §3.4.
 */
export function publishedAtFromUrn(urn: string): Date | null {
  const match = /urn:li:(?:activity|share):(\d+)/.exec(urn);
  if (!match) return null;
  try {
    const id = BigInt(match[1]);
    const ms = Number(id >> 22n);
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return new Date(ms);
  } catch {
    return null;
  }
}

/**
 * Estimates a post's creation time from LinkedIn's relative timestamp text ("3d", "2h",
 * "1w", "Just now"), relative to `now`. Used when there's no URN to decode exactly.
 */
export function publishedAtFromRelativeText(text: string, now: Date): Date | null {
  if (/just now/i.test(text)) return new Date(now.getTime());
  // Order matters: more specific alternatives (e.g. "mon", "min") must come before the
  // single-letter forms they'd otherwise be swallowed by (e.g. "m" would eat the "m" in "mo").
  const match = /(\d+)\s*(sec|s|min|mon|mo|m|hr|h|day|d|wk|w|year|yr)/i.exec(text);
  if (!match) return null;
  const amount = Number(match[1]);
  const rawUnit = match[2].toLowerCase();
  const unit = rawUnit.startsWith('mo')
    ? 'mo'
    : rawUnit.startsWith('yr') || rawUnit.startsWith('year')
      ? 'yr'
      : (rawUnit[0] as keyof typeof UNIT_MS);
  const unitMs = UNIT_MS[unit];
  if (!unitMs || !Number.isFinite(amount)) return null;
  return new Date(now.getTime() - amount * unitMs);
}
