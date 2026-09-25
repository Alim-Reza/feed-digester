import type { DbClient } from '../db/client';

/**
 * The stage batch loop from plan §3.3: select a batch in the source state, process it,
 * commit the batch's writes and status transitions in one transaction, repeat until none
 * are left. `processBatch` should use repositories built on the same `db` instance passed
 * here — better-sqlite3 is a single, synchronous connection, so their writes land inside
 * the same transaction without needing a separate `tx` handle threaded through.
 *
 * This is what makes a stage idempotent: a crash mid-loop leaves already-committed batches
 * done and the rest still in the source state, so the next run's `selectBatch` just picks
 * up where it left off.
 */
export function runBatchLoop<T>(
  db: DbClient,
  opts: {
    selectBatch: (limit: number) => T[];
    processBatch: (batch: T[]) => void;
    batchSize?: number;
  },
): { batches: number; items: number } {
  const batchSize = opts.batchSize ?? 25;
  let batches = 0;
  let items = 0;
  for (;;) {
    const batch = opts.selectBatch(batchSize);
    if (batch.length === 0) break;
    db.transaction(() => opts.processBatch(batch));
    batches += 1;
    items += batch.length;
  }
  return { batches, items };
}
