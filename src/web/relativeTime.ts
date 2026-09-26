/**
 * Formats a past timestamp as a short "Xm ago" / "Xh ago" / "Xd ago" string for the header's
 * "Local index updated ..." status text (docs/ui-redesign-handoff.md §7 step 3) — real data
 * (the latest succeeded run's `finishedAt`), not a hardcoded "8m ago" like the reference
 * screenshot. Deliberately coarse (minutes/hours/days only) — this is chrome text, not a
 * precision timestamp.
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
