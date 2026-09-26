import { ChevronDown } from 'lucide-react';
import type { BriefingStats } from '@/src/web/digestView';

/**
 * The "Triage details" collapsible from docs/image.png, expanded by default. Built as a plain
 * `<details>`/`<summary>` — no client JS needed for an expand/collapse toggle. The sentence is
 * templated from the same real `briefing` stats the stats strip already shows, plus this app's
 * own real filter categories (`config.filtering`'s celebration/low-value/blocklist reasons) —
 * not fabricated copy.
 */
export function TriageDetails({ briefing }: { briefing: BriefingStats }) {
  const { postsFilteredNoise, duplicatesMerged } = briefing;

  let sentence: string;
  if (postsFilteredNoise > 0) {
    sentence = `${postsFilteredNoise} low-value post${postsFilteredNoise === 1 ? ' was' : 's were'} hidden: celebration posts, engagement bait, and other noise caught before classification.`;
  } else {
    sentence = 'No low-value posts needed hiding this cycle.';
  }
  if (duplicatesMerged > 0) {
    sentence += ` ${duplicatesMerged} repeated discussion${duplicatesMerged === 1 ? ' was' : 's were'} merged into ${duplicatesMerged === 1 ? 'its' : 'their'} strongest signal.`;
  }

  return (
    <details open className="group border-t border-border pt-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        Triage details
        <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-sm text-muted-foreground">{sentence}</p>
    </details>
  );
}
