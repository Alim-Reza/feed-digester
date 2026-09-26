import { Briefcase } from 'lucide-react';
import type { JobMarketView } from '@/src/services/jobs/aggregate';

/**
 * Restyled Job Market section — no screenshot reference for this (docs/ui-redesign-handoff.md
 * §2: "doesn't need to look like anything in the screenshots"), just the new dark card/accent
 * language applied to the same real aggregate data already computed by
 * `services/jobs/aggregate.ts`.
 */
export function JobMarketSection({ jobMarket }: { jobMarket: JobMarketView }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <Briefcase className="size-4 text-accent-signal" />
        <h2 className="text-xl font-bold">Job market</h2>
        <span className="text-sm text-muted-foreground">
          · {jobMarket.totalOpenings} opening{jobMarket.totalOpenings === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTable title="Companies hiring" rows={jobMarket.companies} />
        <StatTable title="Roles" rows={jobMarket.roles} />
        <StatTable title="Most requested skills" rows={jobMarket.skills} />
        <StatTable title="Seniority levels" rows={jobMarket.seniorities} />
        <StatTable title="Locations" rows={jobMarket.locations} />
      </div>

      {jobMarket.openings.length > 0 && (
        <div className="flex flex-col gap-2">
          {jobMarket.openings.map((opening, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{opening.role}</span>
                {opening.company && <span className="text-muted-foreground">· {opening.company}</span>}
                {opening.location && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {opening.location}
                  </span>
                )}
                {opening.remoteStatus && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {opening.remoteStatus}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {opening.url ? (
                  <a href={opening.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent-signal hover:underline">
                    {opening.authorName}
                  </a>
                ) : (
                  opening.authorName
                )}
              </div>
              {opening.whyRelevant && <p className="text-xs text-muted-foreground">{opening.whyRelevant}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatTable({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className="flex flex-col gap-1">
        {rows.slice(0, 8).map((row) => (
          <div key={row.name} className="flex items-center justify-between text-sm">
            <span>{row.name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
