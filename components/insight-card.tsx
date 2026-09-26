import Link from 'next/link';
import { ChevronRight, Layers } from 'lucide-react';
import type { TopicView } from '@/src/web/digestView';
import { WhyItMatters } from '@/components/why-it-matters';
import { CardActions } from '@/components/card-actions';

/**
 * One ranked-insight card from docs/image.png. `priority` follows
 * docs/ui-redesign-handoff.md §5's judgment call: the screenshot shows the badge only on the
 * single highest-ranked insight, so it's `rank === 1` rather than a `noveltyLevel === 'high'`
 * per-card condition.
 */
export function InsightCard({
  digestId,
  categoryLabel,
  priority,
  topic,
}: {
  digestId: string;
  categoryLabel: string;
  priority: boolean;
  topic: TopicView;
}) {
  const detailHref = `/digests/${digestId}/insights/${topic.id}`;
  const sourceCount = topic.sources.length;

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
          <span className="text-accent-signal">{String(topic.rank).padStart(2, '0')}</span>
          <span className="text-muted-foreground">{categoryLabel}</span>
          {priority && (
            <span className="rounded-full bg-accent-signal/15 px-1.5 py-0.5 text-[0.65rem] text-accent-signal">
              Priority
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {sourceCount} source{sourceCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Link href={detailHref} className="font-heading text-lg leading-snug font-bold hover:underline">
          {topic.title}
        </Link>
        <p className="text-sm leading-relaxed text-muted-foreground">{topic.summary}</p>
      </div>

      {topic.whyItMatters && <WhyItMatters text={topic.whyItMatters} size="sm" />}

      {topic.suggestedAction && (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Suggested:</span> {topic.suggestedAction}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
        <Link
          href={detailHref}
          className="flex items-center gap-1 text-sm text-foreground hover:text-accent-signal"
        >
          <Layers className="size-3.5" />
          Review sources
          <ChevronRight className="size-3.5" />
        </Link>
        <CardActions openUrl={topic.sources[0]?.url ?? null} />
      </div>
    </article>
  );
}
