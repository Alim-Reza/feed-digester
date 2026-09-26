import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Quote } from 'lucide-react';
import { getWebContext } from '@/src/web/context';
import { getDigestDetail, findInsight } from '@/src/web/digestView';
import { WhyItMatters } from '@/components/why-it-matters';
import { InsightActions } from '@/components/insight-actions';

// Reads live DB state the worker writes outside any build — must not be statically prerendered.
export const dynamic = 'force-dynamic';

export default async function InsightDetailPage({
  params,
}: PageProps<'/digests/[id]/insights/[insightId]'>) {
  const { id, insightId } = await params;
  const { repos, config } = getWebContext();
  const digest = getDigestDetail(repos, config, id);
  if (!digest) notFound();

  const found = findInsight(digest, insightId);
  if (!found) notFound();
  const { topic, categoryLabel } = found;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
      <Link
        href={`/digests/${digest.id}`}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to briefing
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold tracking-widest uppercase">
              <span className="text-accent-signal">{categoryLabel}</span>
              <span className="text-muted-foreground"> · SYNTHESIZED INSIGHT</span>
            </p>
            <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">{topic.title}</h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{topic.summary}</p>
          </div>

          {topic.whyItMatters && <WhyItMatters text={topic.whyItMatters} size="lg" />}

          {topic.suggestedAction && (
            <div className="flex flex-col gap-1.5 border-t border-border pt-6">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Suggested action
              </p>
              <p className="text-base text-foreground">{topic.suggestedAction}</p>
            </div>
          )}

          <InsightActions />
        </div>

        <aside className="flex flex-col gap-5 border-t border-border pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <div>
            <p className="text-xs font-semibold tracking-wide text-accent-signal uppercase">Source set</p>
            <h2 className="text-lg font-bold">
              {topic.sources.length} related post{topic.sources.length === 1 ? '' : 's'}
            </h2>
          </div>

          <div className="flex flex-col gap-5">
            {topic.sources.map((source) => (
              <div key={source.rank} className="flex flex-col gap-2 border-b border-border pb-5 last:border-b-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Source {String(source.rank).padStart(2, '0')}
                  </span>
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open source"
                      className="text-muted-foreground hover:text-accent-signal"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
                <p className="font-semibold text-foreground">{source.authorName}</p>
                {source.authorHeadline && (
                  <p className="text-sm text-muted-foreground">{source.authorHeadline}</p>
                )}
                {source.excerpt && (
                  <div className="flex items-start gap-2 rounded-md bg-accent-signal/10 p-3">
                    <Quote className="mt-0.5 size-3.5 shrink-0 text-accent-signal" />
                    <p className="text-sm text-muted-foreground">{source.excerpt}</p>
                  </div>
                )}
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-fit items-center gap-1 text-sm text-foreground hover:text-accent-signal"
                  >
                    Open LinkedIn post
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
