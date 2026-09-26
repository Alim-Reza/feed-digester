import { getWebContext } from '@/src/web/context';
import { postProcessingStatuses, type PostProcessingStatus } from '@/src/db/schema';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { submitFeedback, submitLabel } from './actions';

// Reads live DB state the worker writes outside any build — must not be statically prerendered.
export const dynamic = 'force-dynamic';

const RELEVANCE_LEVELS = [
  { value: '0', label: 'Not relevant' },
  { value: '0.33', label: 'Somewhat relevant' },
  { value: '0.66', label: 'Relevant' },
  { value: '1', label: 'Highly relevant' },
];

function isKnownStatus(value: unknown): value is PostProcessingStatus {
  return typeof value === 'string' && (postProcessingStatuses as readonly string[]).includes(value);
}

export default async function PostsPage({ searchParams }: PageProps<'/posts'>) {
  const params = await searchParams;
  const statusParam = Array.isArray(params.status) ? params.status[0] : params.status;
  const qParam = Array.isArray(params.q) ? params.q[0] : params.q;
  const status = isKnownStatus(statusParam) ? statusParam : undefined;
  const q = qParam && qParam.trim() !== '' ? qParam : undefined;

  const { repos, config } = getWebContext();
  const posts = repos.posts.list({ status, q, limit: 100 });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10">
      <div>
        <p className="text-xs font-semibold tracking-widest text-accent-signal uppercase">Archive</p>
        <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse collected posts, including dropped ones (grill I3), and label ground truth for
          the classifier bake-off (grill E5/ADR 0003).
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-xs text-muted-foreground">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? 'all'}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All</option>
            {postProcessingStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-xs text-muted-foreground">
            Search
          </label>
          <Input id="q" name="q" defaultValue={q ?? ''} placeholder="author or content" className="w-56" />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Filter
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        {posts.length} post{posts.length === 1 ? '' : 's'}
      </p>

      <div className="flex flex-col gap-3">
        {posts.map((post) => {
          const analysis = repos.postAnalysis.get(post.id);
          return (
            <div key={post.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{post.authorName}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{post.processingStatus}</Badge>
                  {post.dropReason && <Badge variant="secondary">{post.dropReason}</Badge>}
                  {analysis && (
                    <Badge variant="secondary">
                      {analysis.primaryCategory} · {analysis.relevance.toFixed(2)}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {post.content || '(no text captured)'}
              </p>
              {post.ocrText && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground italic">
                  Image text: {post.ocrText}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <form action={submitFeedback.bind(null, post.id, 'up')}>
                  <Button type="submit" size="xs" variant="ghost" aria-label="Thumbs up">
                    👍
                  </Button>
                </form>
                <form action={submitFeedback.bind(null, post.id, 'down')}>
                  <Button type="submit" size="xs" variant="ghost" aria-label="Thumbs down">
                    👎
                  </Button>
                </form>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Label</summary>
                  <form action={submitLabel.bind(null, post.id)} className="mt-2 flex flex-col gap-2">
                    <div className="flex flex-wrap gap-3">
                      {config.categories.map((c) => (
                        <label key={c.id} className="flex items-center gap-1.5">
                          <input type="checkbox" name="categories" value={c.id} className="size-3.5" />
                          {c.label}
                        </label>
                      ))}
                    </div>
                    <select
                      name="relevance"
                      defaultValue="0.66"
                      className="h-8 w-fit rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {RELEVANCE_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="secondary" className="self-start">
                      Save label
                    </Button>
                  </form>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
