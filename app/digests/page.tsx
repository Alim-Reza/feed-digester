import Link from 'next/link';
import { getWebContext } from '@/src/web/context';
import { listDigests } from '@/src/web/digestView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

// Reads live DB state the worker writes outside any build — must not be statically prerendered.
export const dynamic = 'force-dynamic';

export default function DigestsPage() {
  const { repos } = getWebContext();
  const digests = listDigests(repos);

  if (digests.length === 0) {
    return <p className="text-sm text-muted-foreground">No digests yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Digests</h1>
      <div className="flex flex-col gap-3">
        {digests.map((d) => (
          <Link key={d.id} href={`/digests/${d.id}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">{dateFormat.format(d.createdAt)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {d.totalPosts} post{d.totalPosts === 1 ? '' : 's'} · window{' '}
                {dateFormat.format(d.windowStart)} – {dateFormat.format(d.windowEnd)}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
