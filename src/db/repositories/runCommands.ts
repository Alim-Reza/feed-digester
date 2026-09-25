import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { newId } from '../ids';
import { runCommands, type RunCommandType } from '../schema';

export type RunCommandRow = typeof runCommands.$inferSelect;

export function createRunCommandsRepository(db: DbClient) {
  return {
    /** Called by `web` only — inserting a command is the only pipeline write it's allowed. */
    enqueue(type: RunCommandType): RunCommandRow {
      const row = { id: newId(), type, status: 'pending' as const, createdAt: new Date() };
      db.insert(runCommands).values(row).run();
      return row;
    },

    /**
     * Called by `worker`'s poller. Atomically claims the oldest pending command so two
     * poll ticks can never both pick it up.
     */
    claimNext(): RunCommandRow | undefined {
      return db.transaction((tx) => {
        const next = tx
          .select()
          .from(runCommands)
          .where(eq(runCommands.status, 'pending'))
          .orderBy(runCommands.createdAt, sql`rowid`)
          .limit(1)
          .get();
        if (!next) return undefined;
        tx.update(runCommands).set({ status: 'claimed' }).where(eq(runCommands.id, next.id)).run();
        return { ...next, status: 'claimed' as const };
      });
    },

    complete(id: string): void {
      db.update(runCommands).set({ status: 'done' }).where(eq(runCommands.id, id)).run();
    },

    fail(id: string): void {
      db.update(runCommands).set({ status: 'failed' }).where(eq(runCommands.id, id)).run();
    },
  };
}

export type RunCommandsRepository = ReturnType<typeof createRunCommandsRepository>;
