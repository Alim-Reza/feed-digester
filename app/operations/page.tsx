import Link from 'next/link';
import { getWebContext } from '@/src/web/context';
import { runStatusVariant } from '@/src/web/badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { triggerRun, updateClassifier, updateFilterLists, updateThresholds } from './actions';

// Reads live DB state the worker writes outside any build — must not be statically prerendered.
export const dynamic = 'force-dynamic';

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export default function OperationsPage() {
  const { repos, config } = getWebContext();
  const runs = repos.runs.listRecent(20);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Operations</h1>
        <p className="text-sm text-muted-foreground">Trigger runs, watch status, edit config.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Run</h2>
        <div className="flex flex-wrap gap-2">
          <form action={triggerRun.bind(null, 'full')}>
            <Button type="submit">Run full pipeline</Button>
          </form>
          <form action={triggerRun.bind(null, 'collect')}>
            <Button type="submit" variant="secondary">
              Collect only
            </Button>
          </form>
          <form action={triggerRun.bind(null, 'process')}>
            <Button type="submit" variant="secondary">
              Process collected
            </Button>
          </form>
          <form action={triggerRun.bind(null, 'login')}>
            <Button type="submit" variant="outline">
              Log in
            </Button>
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {runs.map((run) => (
              <Link key={run.id} href={`/operations/runs/${run.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {run.trigger}
                        {run.currentStage ? ` · ${run.currentStage}` : ''}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {run.startedAt ? dateFormat.format(run.startedAt) : 'not started'}
                      </span>
                    </div>
                    <Badge variant={runStatusVariant[run.status] ?? 'outline'}>{run.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Config</h2>
        <p className="text-xs text-muted-foreground">
          Saved to the database and layered over the file defaults (grill I1/J13) — a change here
          takes effect the next time the worker process restarts, not mid-run.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thresholds</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateThresholds} className="flex flex-wrap items-end gap-4">
              <NumberField label="Relevance" name="relevance" defaultValue={config.thresholds.relevance} />
              <NumberField label="Job" name="job" defaultValue={config.thresholds.job} />
              <NumberField
                label="Cluster score"
                name="clusterScore"
                defaultValue={config.thresholds.clusterScore}
              />
              <Button type="submit" size="sm">
                Save
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classifier (ADR 0003 bake-off)</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateClassifier} className="flex items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="active">Active classifier</Label>
                <select
                  id="active"
                  name="active"
                  defaultValue={config.classification.active}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="laya">laya</option>
                  <option value="gemma4">gemma4</option>
                </select>
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filter lists</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateFilterLists} className="flex flex-col gap-4">
              <ListField
                label="Allowlist (one per line — overrides every other rule)"
                name="allowlist"
                defaultValue={config.filtering.allowlist}
              />
              <ListField
                label="Blocklist (one per line)"
                name="blocklist"
                defaultValue={config.filtering.blocklist}
              />
              <ListField
                label="Celebration phrases (one per line)"
                name="celebrationPhrases"
                defaultValue={config.filtering.celebrationPhrases}
              />
              <Button type="submit" size="sm" className="self-start">
                Save
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        step="0.05"
        min="0"
        max="1"
        defaultValue={defaultValue}
        className="w-28"
      />
    </div>
  );
}

function ListField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} defaultValue={defaultValue.join('\n')} rows={3} />
    </div>
  );
}
