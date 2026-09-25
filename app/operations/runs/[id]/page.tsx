import { notFound } from 'next/navigation';
import { getWebContext } from '@/src/web/context';
import { runEventLevelVariant, runStatusVariant } from '@/src/web/badges';
import { Badge } from '@/components/ui/badge';

// Reads live DB state the worker writes outside any build — must not be statically prerendered.
export const dynamic = 'force-dynamic';

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'medium' });

export default async function RunDetailPage({ params }: PageProps<'/operations/runs/[id]'>) {
  const { id } = await params;
  const { repos } = getWebContext();
  const run = repos.runs.get(id);
  if (!run) notFound();
  const events = repos.runEvents.listForRun(id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">
          Run <span className="font-mono text-base text-muted-foreground">{run.id}</span>
        </h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={runStatusVariant[run.status] ?? 'outline'}>{run.status}</Badge>
          <span>{run.trigger}</span>
          {run.currentStage && <span>· stage: {run.currentStage}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events logged yet.</p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex items-start gap-2 border-b border-border py-1.5 font-mono text-xs">
              <span className="shrink-0 text-muted-foreground">{dateFormat.format(e.ts)}</span>
              <Badge variant={runEventLevelVariant[e.level] ?? 'outline'} className="shrink-0">
                {e.level}
              </Badge>
              <span>
                {e.stage ? `[${e.stage}] ` : ''}
                {e.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
