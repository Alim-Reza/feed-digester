# ADR 0002: A SQLite-backed pipeline runner

## Status

Accepted (confirmed in grill part 3, Q17)

## Context

Given ADR 0001, something still has to provide what the spec asks for:
resumable, idempotent, retryable, logged processing across multiple stages,
running unattended once a day, on a single Mac, restartable at any point.

## Decision

- `runs` is the top-level record of one pipeline execution: `id`, `trigger`
  (manual/scheduled), `status` (queued/running/awaiting_user/interrupted/
  succeeded/failed), `currentStage`, timestamps, and a JSON `stats` blob.
- Each post carries its own `processingStatus` state machine (`new →
ocr_done → filtered|dropped → classified|dropped → enriched → clustered →
digested`, plus `failed`), with `attempts` and `lastError`.
- Every stage is a loop: select a batch of posts in the state it consumes,
  process them, and **commit the batch's output and status transition in one
  SQLite transaction**. Repeat until no posts remain in that state. This is
  what makes a stage idempotent — re-running it only ever picks up whatever
  wasn't already moved forward.
- On worker startup, any run still marked `running` (a sign the process died
  mid-run) is marked `interrupted` and resumed from `currentStage`.
- Batches retry with exponential backoff, up to 3 attempts; a post that still
  fails is marked `failed` and the run continues without it. Failed posts are
  visible in the UI rather than silently dropped.
- Two processes share the database in WAL mode: `web` only inserts
  `run_commands` and reads; `worker` is the only writer of pipeline data, and
  runs one run at a time (enforced by a lock row).

## Consequences

- No separate workflow engine or queue to operate — SQLite is already the
  system's database.
- Resumability is a direct consequence of small, transactional batches rather
  than a framework feature, so it's easy to reason about and to test (crash
  mid-stage → restart → finishes without reprocessing).
- The single-writer constraint means throughput is bounded by one worker
  process, which is fine at this scale (hundreds of posts/day) and matches
  the 16 GB memory budget that already requires stages to run one at a time.
- The Postgres/Supabase path stays open (Drizzle abstracts the dialect), so
  moving off SQLite later doesn't require redesigning the runner.
