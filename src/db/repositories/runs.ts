import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { newId } from '../ids';
import { runs, type RunStatus, type RunTrigger } from '../schema';

export type RunRow = typeof runs.$inferSelect;

export function createRunsRepository(db: DbClient) {
  return {
    create(trigger: RunTrigger): RunRow {
      const row = { id: newId(), trigger, status: 'queued' as const, stats: {} };
      db.insert(runs).values(row).run();
      return db.select().from(runs).where(eq(runs.id, row.id)).get()!;
    },

    get(id: string): RunRow | undefined {
      return db.select().from(runs).where(eq(runs.id, id)).get();
    },

    start(id: string): void {
      db.update(runs)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(runs.id, id))
        .run();
    },

    setStage(id: string, stage: string): void {
      db.update(runs).set({ currentStage: stage }).where(eq(runs.id, id)).run();
    },

    /** Resumes an `interrupted` run without disturbing its original `startedAt`. */
    resume(id: string): void {
      db.update(runs).set({ status: 'running' }).where(eq(runs.id, id)).run();
    },

    /** Any run not yet in a terminal state blocks starting another (ADR 0002: one run at a time). */
    hasActiveRun(): boolean {
      return (
        db
          .select({ id: runs.id })
          .from(runs)
          .where(inArray(runs.status, ['queued', 'running', 'awaiting_user', 'interrupted']))
          .limit(1)
          .get() !== undefined
      );
    },

    /** Whether a run with this trigger has already succeeded since `dayStart`. */
    succeededSince(trigger: RunTrigger, dayStart: Date): boolean {
      return (
        db
          .select({ id: runs.id })
          .from(runs)
          .where(
            and(
              eq(runs.trigger, trigger),
              eq(runs.status, 'succeeded'),
              gte(runs.startedAt, dayStart),
            ),
          )
          .limit(1)
          .get() !== undefined
      );
    },

    /** How many runs with this trigger have started since `since`, any outcome — the scheduler's daily attempt cap (grill B2/Q5: "caps on... runs per day", `stopConditions.maxRunsPerDay`). */
    countStartedSince(trigger: RunTrigger, since: Date): number {
      const row = db
        .select({ count: sql<number>`count(*)` })
        .from(runs)
        .where(and(eq(runs.trigger, trigger), gte(runs.startedAt, since)))
        .get();
      return row?.count ?? 0;
    },

    finish(
      id: string,
      status: Extract<RunStatus, 'succeeded' | 'failed' | 'awaiting_user'>,
      stats?: Record<string, unknown>,
    ): void {
      const patch: Partial<RunRow> = { status, ...(stats ? { stats } : {}) };
      if (status !== 'awaiting_user') patch.finishedAt = new Date();
      db.update(runs).set(patch).where(eq(runs.id, id)).run();
    },

    /**
     * On worker startup: any run still `running` means the process died mid-run.
     * Marks them `interrupted` so the runner can resume from `currentStage`. See ADR 0002.
     */
    interruptRunningOnStartup(): RunRow[] {
      return db.transaction((tx) => {
        const stale = tx.select().from(runs).where(eq(runs.status, 'running')).all();
        for (const run of stale) {
          tx.update(runs).set({ status: 'interrupted' }).where(eq(runs.id, run.id)).run();
        }
        return stale.map((r) => ({ ...r, status: 'interrupted' as const }));
      });
    },

    latest(): RunRow | undefined {
      return db
        .select()
        .from(runs)
        .orderBy(sql`rowid desc`)
        .limit(1)
        .get();
    },

    /** The `limit` most recently finished `succeeded` runs, newest first — the `retention` stage's cycle counter (grill B4/Q7). */
    listRecentSucceeded(limit: number): RunRow[] {
      return db
        .select()
        .from(runs)
        .where(eq(runs.status, 'succeeded'))
        .orderBy(desc(runs.finishedAt))
        .limit(limit)
        .all();
    },

    listRecent(limit = 20): RunRow[] {
      return db
        .select()
        .from(runs)
        .orderBy(sql`rowid desc`)
        .limit(limit)
        .all();
    },
  };
}

export type RunsRepository = ReturnType<typeof createRunsRepository>;
