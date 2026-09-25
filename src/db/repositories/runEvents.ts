import { eq } from 'drizzle-orm';
import type { DbClient } from '../client';
import { runEvents, type RunEventLevel } from '../schema';

export type RunEventRow = typeof runEvents.$inferSelect;

export function createRunEventsRepository(db: DbClient) {
  return {
    log(
      runId: string,
      level: RunEventLevel,
      message: string,
      opts: { stage?: string; data?: Record<string, unknown> } = {},
    ): void {
      db.insert(runEvents)
        .values({
          runId,
          level,
          message,
          stage: opts.stage ?? null,
          data: opts.data ?? null,
          ts: new Date(),
        })
        .run();
    },

    listForRun(runId: string): RunEventRow[] {
      return db.select().from(runEvents).where(eq(runEvents.runId, runId)).all();
    },
  };
}

export type RunEventsRepository = ReturnType<typeof createRunEventsRepository>;
