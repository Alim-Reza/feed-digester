import { redirect } from 'next/navigation';
import { getWebContext } from '@/src/web/context';

// Reads live DB state the worker writes outside any build — must not be statically prerendered.
export const dynamic = 'force-dynamic';

export default function Home() {
  const { repos } = getWebContext();
  const latest = repos.digests.latest();

  if (latest) redirect(`/digests/${latest.id}`);

  return (
    <div className="flex flex-col items-center gap-2 py-24 text-center text-muted-foreground">
      <h1 className="text-lg font-medium text-foreground">No digests yet</h1>
      <p className="max-w-sm text-sm">
        Run a collection and processing cycle to generate your first digest.
      </p>
    </div>
  );
}
