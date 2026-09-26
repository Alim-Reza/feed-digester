'use client';

import { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from 'cn';
import type { TopicView } from '@/src/web/digestView';
import { InsightCard } from '@/components/insight-card';

export type CategoryTab = { id: string; label: string; topics: TopicView[] };

/**
 * The filter-tabs + ranked-card-grid section of "Today's Briefing" (docs/image.png). All
 * sections are already fetched server-side (`getDigestDetail`), so category filtering is plain
 * client-side show/hide over data already on the page — no navigation, no new data fetch, per
 * docs/ui-redesign-handoff.md §7 step 4's suggested approach.
 */
export function BriefingBoard({
  digestId,
  categories,
  postsUseful,
}: {
  digestId: string;
  categories: CategoryTab[];
  postsUseful: number;
}) {
  const categoryLabelByTopicId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) for (const t of c.topics) map.set(t.id, c.label);
    return map;
  }, [categories]);
  const topTab: CategoryTab = useMemo(
    () => ({
      id: 'top',
      label: 'Top',
      topics: categories.flatMap((c) => c.topics).sort((a, b) => a.rank - b.rank),
    }),
    [categories],
  );
  const [activeId, setActiveId] = useState('top');
  const tabs = [topTab, ...categories];
  const active = tabs.find((t) => t.id === activeId) ?? topTab;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                tab.id === activeId
                  ? 'bg-accent-signal text-accent-signal-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* Visual only, per docs/ui-redesign-handoff.md §2/§6: no card-density feature exists to wire this to. */}
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <SlidersHorizontal className="size-3.5" />
          Comfortable
        </span>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-accent-signal uppercase">
            Ranked by relevance
          </p>
          <h2 className="text-xl font-bold">Top signals</h2>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">
          {active.topics.length} of {postsUseful} useful
        </p>
      </div>

      {active.topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">No signals survived triage in this category.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {active.topics.map((topic) => (
            <InsightCard
              key={topic.id}
              digestId={digestId}
              topic={topic}
              categoryLabel={activeId === 'top' ? (categoryLabelByTopicId.get(topic.id) ?? '') : active.label}
              priority={topic.rank === 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
