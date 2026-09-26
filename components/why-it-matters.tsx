import { cn } from 'cn';

/**
 * The orange-left-border "WHY THIS MATTERS TO YOU" callout from both reference screenshots —
 * used at card size on the briefing grid and at a larger, more padded size on the insight-detail
 * page (docs/ui-redesign-handoff.md §5).
 */
export function WhyItMatters({ text, size = 'sm' }: { text: string; size?: 'sm' | 'lg' }) {
  return (
    <div
      className={cn(
        'border-l-2 border-accent-signal bg-accent-signal/10',
        size === 'sm' ? 'flex flex-col gap-1 px-3 py-2' : 'flex flex-col gap-2 rounded-r-md px-6 py-5',
      )}
    >
      <p
        className={cn(
          'font-semibold tracking-wide text-accent-signal uppercase',
          size === 'sm' ? 'text-[0.65rem]' : 'text-xs',
        )}
      >
        Why this matters to you
      </p>
      <p className={cn('text-foreground', size === 'sm' ? 'text-sm' : 'text-lg font-medium')}>{text}</p>
    </div>
  );
}
