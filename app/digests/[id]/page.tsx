import { notFound } from 'next/navigation';
import { getWebContext } from '@/src/web/context';
import { getDigestDetail } from '@/src/web/digestView';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

// Reads live DB state the worker writes outside any build — must not be statically prerendered.
export const dynamic = 'force-dynamic';

export default async function DigestDetailPage({ params }: PageProps<'/digests/[id]'>) {
  const { id } = await params;
  const { repos, config } = getWebContext();
  const digest = getDigestDetail(repos, config, id);
  if (!digest) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Digest</h1>
        <p className="text-sm text-muted-foreground">
          {dateFormat.format(digest.windowStart)} – {dateFormat.format(digest.windowEnd)}
        </p>
      </div>

      {digest.sections.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing survived filtering this cycle.</p>
      )}

      {digest.sections.map((section) => (
        <section key={section.category} className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {section.label} <span className="text-sm font-normal text-muted-foreground">· {section.postCount} post{section.postCount === 1 ? '' : 's'}</span>
            </h2>
            <p className="text-sm text-muted-foreground">{section.tldr}</p>
          </div>

          {section.topics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No featured topics this cycle.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {section.topics.map((topic) => (
                <Card key={topic.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{topic.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <ul className="list-disc space-y-1.5 pl-4 text-sm">
                      {topic.bullets.map((bullet, i) => (
                        <li key={i}>{bullet.text}</li>
                      ))}
                    </ul>
                    {topic.sources.length > 0 && (
                      <div className="flex flex-col gap-1 border-t border-border pt-2 text-xs text-muted-foreground">
                        {topic.sources.map((source) => (
                          <div key={source.rank}>
                            [{source.rank}]{' '}
                            {source.url ? (
                              <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {source.authorName}
                              </a>
                            ) : (
                              source.authorName
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <Separator />
        </section>
      ))}

      {digest.jobMarket && digest.jobMarket.totalOpenings > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">
            Job Market <span className="text-sm font-normal text-muted-foreground">· {digest.jobMarket.totalOpenings} opening{digest.jobMarket.totalOpenings === 1 ? '' : 's'}</span>
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <JobStatTable title="Companies hiring" rows={digest.jobMarket.companies} />
            <JobStatTable title="Roles" rows={digest.jobMarket.roles} />
            <JobStatTable title="Most requested skills" rows={digest.jobMarket.skills} />
            <JobStatTable title="Seniority levels" rows={digest.jobMarket.seniorities} />
            <JobStatTable title="Locations" rows={digest.jobMarket.locations} />
          </div>
        </section>
      )}
    </div>
  );
}

function JobStatTable({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 10).map((row) => (
            <TableRow key={row.name}>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right">
                <Badge variant="secondary">{row.count}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
