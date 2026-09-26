import { CircleCheck, Clock, Copy, EyeOff, ScanSearch } from 'lucide-react';
import type { BriefingStats } from '@/src/web/digestView';

/**
 * The reference's 5-tile stats row (docs/image.png): icon + big number + small caption per tile,
 * separated by thin vertical dividers rather than separate cards. `BriefingStats` already has
 * exactly these five numbers (docs/ui-redesign-handoff.md §4) — no mapping work beyond icons.
 */
export function StatsStrip({ briefing }: { briefing: BriefingStats }) {
  const tiles = [
    { icon: ScanSearch, value: briefing.postsScanned, label: 'Posts scanned' },
    { icon: CircleCheck, value: briefing.postsUseful, label: 'Useful', accent: true },
    { icon: EyeOff, value: briefing.postsFilteredNoise, label: 'Noise hidden' },
    { icon: Copy, value: briefing.duplicatesMerged, label: 'Duplicates merged' },
    { icon: Clock, value: `~${briefing.estimatedReadingMinutes}`, label: 'Min read' },
  ];

  return (
    <div className="flex divide-x divide-border rounded-xl border border-border bg-card">
      {tiles.map(({ icon: Icon, value, label, accent }) => (
        <div key={label} className="flex flex-1 flex-col gap-1 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Icon className={`size-4 ${accent ? 'text-accent-signal' : 'text-muted-foreground'}`} />
            <span className={`font-heading text-xl font-bold ${accent ? 'text-accent-signal' : 'text-foreground'}`}>
              {value}
            </span>
          </div>
          <span className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">{label}</span>
        </div>
      ))}
    </div>
  );
}
