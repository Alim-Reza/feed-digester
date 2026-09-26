import { notFound } from 'next/navigation';
import { getWebContext } from '@/src/web/context';
import { getDigestDetail } from '@/src/web/digestView';
import { StatsStrip } from '@/components/stats-strip';
import { BriefingBoard, type CategoryTab } from '@/components/briefing-board';
import { TriageDetails } from '@/components/triage-details';
import { JobMarketSection } from '@/components/job-market-section';

const eyebrowDateFormat = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' });

// Reads live DB state the worker writes outside any build — must not be statically prerendered.
export const dynamic = 'force-dynamic';

export default async function DigestDetailPage({ params }: PageProps<'/digests/[id]'>) {
  const { id } = await params;
  const { repos, config } = getWebContext();
  const digest = getDigestDetail(repos, config, id);
  if (!digest) notFound();

  const { briefing } = digest;
  const totalInsights = digest.sections.reduce((sum, s) => sum + s.topics.length, 0);
  const categories: CategoryTab[] = digest.sections.map((s) => ({
    id: s.category,
    label: s.label,
    topics: s.topics,
  }));
  const eyebrow = eyebrowDateFormat.format(digest.windowEnd).toUpperCase().replace(', ', ' · ');

  return (
    <div className="flex flex-col gap-8 pb-16">
      <div className="mx-auto w-full max-w-7xl px-6 pt-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-widest text-accent-signal">{eyebrow}</p>
            <h1 className="text-4xl font-bold tracking-tight">Today&apos;s Briefing</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              {totalInsights} signal{totalInsights === 1 ? '' : 's'} survived today&apos;s triage, ranked
              below by relevance to your current work.
            </p>
          </div>
          <StatsStrip briefing={briefing} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6">
        {totalInsights === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing worth surfacing survived this cycle.</p>
        ) : (
          <BriefingBoard digestId={digest.id} categories={categories} postsUseful={briefing.postsUseful} />
        )}

        <TriageDetails briefing={briefing} />

        {digest.jobMarket && digest.jobMarket.totalOpenings > 0 && (
          <JobMarketSection jobMarket={digest.jobMarket} />
        )}
      </div>
    </div>
  );
}
