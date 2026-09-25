# Project Memory

Final mental model of `feed-digester`, verified against the actual code and tests as they stand
today (2026-09-25, end of slice 12 + the post-launch scheduler fix + the ADR 0003 bake-off).
This is the doc to read first; `docs/decisions.md` has the why behind each call,
`docs/build-journal.md` has the how-we-got-here narrative, `docs/session-handoff.md` is for
picking the work back up.

## What it is

A local-first tool that logs into your own LinkedIn account, scrolls your feed like a human,
filters and classifies what it sees, clusters related posts into topics, summarizes each topic
with an LLM, and produces a short, finite daily digest — instead of you doom-scrolling. It also
extracts structured job-posting data (company/role/skills/seniority) into a "Job Market"
section. Everything runs on one Mac; nothing about the design assumes a server.

## The two-process architecture

- **`web`** (Next.js App Router, `app/`) is read-only against pipeline data. Its only write is
  inserting a row into `run_commands` (`repos.runCommands.enqueue`, called from three places:
  `/operations`'s trigger buttons) plus writing to `settings` (config overrides) and `feedback`
  (👍/👎 and labels). It never touches posts, digests, or any other pipeline table.
- **`worker`** (`src/worker/main.ts`) is the only process that writes pipeline data. It polls
  `run_commands` every 2s, checks the daily schedule every 60s, and runs the pipeline one stage
  at a time. Only one run is ever active at once (`runs.hasActiveRun()`).
- Both open the same SQLite file (`data/feed-digester.sqlite`) in WAL mode, so `web` can read
  live while `worker` writes (ADR 0002).
- `pnpm dev` runs both together via `concurrently`. There is no separate deploy step for either
  — they're meant to run on the same Mac, most of the day, with the worker mostly idle.

## The pipeline

Fixed order, each stage idempotent and resumable, defined in `src/pipeline/stages/index.ts`:

```
collect → ocr → filter → classify → extract-jobs → cluster → summarize → digest → retention
```

Every post has a `processingStatus` (`new → ocr_done → filtered|dropped → classified|dropped →
enriched → clustered → digested`, plus `failed`). A stage selects a batch of posts in the state
it consumes, processes them, and commits the batch's writes and status change in one SQLite
transaction (`runBatchLoop`, `src/pipeline/batch.ts`) — that's the entire idempotency mechanism.
A crash mid-run leaves already-committed batches done and the rest untouched; the worker detects
any row still `running` on startup, marks it `interrupted`, and `runPipeline` resumes from
`currentStage` (ADR 0002).

**Stage-by-stage, what each one actually does:**

- **`collect`** (`src/collector/`, wired by `src/pipeline/stages/collect.ts`): opens a dedicated,
  persistent Chrome profile (`~/.feed-digester/profiles/<name>`, `channel: 'chrome'`, headed) via
  Playwright, scrolls the feed with randomized pacing, parses visible posts via ARIA selectors
  (not CSS classes — see below), dedupes via `posts.insertOrTouch`, screenshots likely-visual
  posts. A checkpoint/login-wall pauses the run (`AwaitingUserSignal`) rather than trying to push
  through it.
- **`ocr`**: runs `tesseract.js` (English + Bangla) on kept screenshots; keeps the image and its
  text only if the text "looks real" (`looksLikeRealText`, counts letters _and_ combining marks
  so Bangla vowel signs aren't miscounted as noise); discards and deletes the file otherwise.
- **`filter`**: cheap deterministic rules, no LLM — allowlist bypasses everything, then
  blocklist/sponsored/connection-suggestion/poll/celebration-phrase/low-text-video/disallowed-
  language, first match wins.
- **`classify`**: the active `Classifier` (config-selected, ADR 0003 picked `gemma4`) scores
  every configured category (multi-label) plus an overall relevance 0..1; posts at or above
  `thresholds.relevance` continue, the rest are dropped (`dropReason: 'low_relevance'`) — but the
  analysis row is kept either way.
- **`extract-jobs`**: only for posts whose `job` category score clears `thresholds.job` — most
  posts never reach the LLM here at all. Decides `isHiringPost` (job-seeker posts don't count)
  and extracts one `JobOpening` row per distinct role mentioned.
- **`cluster`**: embeds every `enriched` post (`embeddinggemma` via Ollama), groups by primary
  category, and runs a small pure greedy single-pass clustering algorithm
  (`src/services/clustering/cluster.ts`) — no k-means, no persisted cluster identity across
  digests. Creates the digest's `topicClusters`/`topicClusterPosts` rows.
- **`summarize`**: for the top 5 clusters per category (by member count), asks the LLM for a
  title + 2-4 bullets, each bullet citing source-post numbers (`[1][2]`) that are validated
  against the sources actually given — an invalid citation is rejected and retried, never
  trusted. Also writes each section's 2-3 sentence TL;DR.
- **`digest`**: advances every clustered post (featured or not) to `digested`, and writes the
  digest's final `stats`, including the spec's Job Market aggregates.
- **`retention`**: purges post text, OCR text, and images older than `retention.keepCompletedRuns`
  completed cycles — keeps URL, author, categories/scores, job rows, and digest summaries, so old
  digests' citations still resolve.

## Data model

13 tables (`src/db/schema.ts`), Drizzle ORM on `better-sqlite3`. The load-bearing ones: `posts`
(the state machine above), `post_images`, `post_analysis` (one row per post: category scores,
primary category, relevance, which classifier/model produced it), `job_openings`, `digests` /
`digest_sections` / `topic_clusters` / `topic_cluster_posts`, `runs` / `run_events` /
`run_commands`, `feedback` (👍/👎, wrong-category, ground-truth labels), `settings` (config
overrides). Two migrations exist (`src/db/migrations/`): the initial schema, and one adding
`isSponsored`/`isConnectionSuggestion`/`isPoll` columns the collector needed but the original
schema hadn't anticipated.

## Config: two layers, read once at process startup

`digest.config.ts` is the typed file default. The `settings` table holds per-key overrides (one
row per top-level `DigestConfig` key, e.g. `settings.get('thresholds')`), written by
`/operations`'s forms. `loadSettingsOverrides` (`src/config/settingsOverrides.ts`) merges them in
— **but only once, at process startup** (`worker/main.ts`, `web/context.ts`). A setting saved
through the UI takes effect on the next restart, not mid-run; nothing in the pipeline re-reads
config once a run starts. Each override is validated against its own field's Zod schema before
being trusted (a malformed row is dropped with a warning, not allowed to crash the process — see
"Known limitations" for why this mattered in practice).

## Swappable interfaces

The spec's explicit ask ("keep Laya, Ollama and Groq implementations swappable") shows up as four
real interfaces, each with a fake used in tests and a real implementation used live:

- `Classifier` (`src/services/classification/types.ts`) — `layaClassifier.ts` (real
  `@receptron/laya`/ONNX) and `gemmaClassifier.ts` (gemma4 batched-prompt via `LLMProvider`).
  ADR 0003 picked gemma4 as `classification.active`; Laya's code is untouched, just not the
  default.
- `LLMProvider` / `Embedder` (`src/llm/types.ts`) — Ollama primary, Groq an optional fallback
  (`fallbackProvider.ts`), off by default.
- `OcrProvider` (`src/services/ocr/provider.ts`) — real `tesseract.js` implementation.
- `CollectorDriver` (`src/collector/driver.ts`) — real Playwright implementation.

None of the real implementations are exercised in the automated test suite (no browser, no real
Ollama call, no real OCR model load) — every stage test injects a fake through these interfaces.

## The UI (`app/`, `components/ui/` via shadcn/Base UI)

- `/` redirects to the latest digest, or shows an empty state.
- `/digests`, `/digests/[id]` — browse past digests; each section shows its TL;DR, featured
  topics (title, cited bullets, numbered source list linking to the original post), and a Job
  Market breakdown when the digest has job openings.
- `/operations` — trigger buttons for each `run_commands` type, a recent-runs list linking to
  `/operations/runs/[id]` for the full event log, and three settings forms (thresholds, active
  classifier, filter lists).
- `/posts` — browse every collected post including dropped ones, filter by status or a text
  search, give 👍/👎 feedback, and label ground-truth category/relevance for the classifier
  bake-off.

All three route groups other than the static `/_not-found` are `export const dynamic =
'force-dynamic'` — they read live worker-written state and must never be statically prerendered
at build time (a real bug caught in the first `pnpm build`: `/` and `/digests` were silently
frozen as static HTML).

## Known limitations (verified against code, not assumed)

- **ADR 0002 says batches "retry with exponential backoff"; the actual code doesn't implement
  any backoff.** `posts.recordAttemptFailure` just increments `attempts` and marks the post
  `failed` at 3 — retries happen whenever the post's stage is next entered (the next scheduled or
  manual run), with no explicit delay calculation anywhere in the source.
- **`relevanceProfile` in `digest.config.ts` is dead.** It was meant to be passed into the
  relevance question (grill D5: "That should be passed to jev/layla"), but neither
  `layaClassifier.ts` nor `gemmaClassifier.ts` ever reads it — gemma4 now computes relevance from
  `relevanceWeights` instead (ADR 0003), and Laya's relevance `score` question never used it
  either, in any slice.
- **The classifier bake-off didn't use the labeled-eval path the ADR originally described.**
  `evaluate-classifiers.ts` (precision/recall/F1 against `feedback` rows of kind `label`) exists
  and is tested, but no one has actually labeled posts in `/posts` yet. The real decision came
  from a different, faster path: `pnpm compare:classifiers` dumped both classifiers' raw output
  over 101 real posts, and an external LLM judged the comparison directly. See
  `docs/adr/0003-classifier-bake-off.md`.
- **Retention's shipped default (`keepCompletedRuns: 14`) doesn't match the grill decision's
  stated default ("Default N = 7").** Not something this session changed — just a discrepancy
  worth knowing if you go looking for "7" and don't find it.
- **Four `src/services/` directories are empty scaffold remnants**: `dedup/`, `digest/`,
  `filtering/`, `retention/`. The spec's suggested layout expected separate service modules for
  these; the actual implementation put dedup logic in `posts.insertOrTouch`, filtering and
  retention logic directly in their `pipeline/stages/*.ts` files, and digest finalization in
  `pipeline/stages/digest.ts` — none of them turned out to need a separate service layer.
- **No automated test opens a real browser, calls real Ollama, or loads a real OCR/classification
  model.** Every such path is tested against a fake behind its interface. This is deliberate
  (grill J9), not an oversight — but it means CI-green doesn't prove the live paths work; those
  were verified by manual smoke tests during each slice (see `docs/plan.md`'s per-slice notes) and,
  for the UI, by hand-curling a `next dev` server against seeded data.
- **No auth, localhost only** (grill I2) — by design for V0, not a gap, but worth stating plainly
  since `app/operations` can trigger real collection/processing with no access control at all.
- **`.env.example`'s comment for `GROQ_API_KEY`** points at `src/llm/fallback.ts`, which doesn't
  exist — the real file is `src/llm/fallbackProvider.ts`. Minor, pre-existing, not fixed here
  (out of this session's scope).

## Where to start reading code

1. `digest.config.ts` + `src/config/schema.ts` — every tunable in the system, in one place.
2. `src/db/schema.ts` — the 13 tables; read this before anything else touches the DB.
3. `src/pipeline/stages/index.ts` and `src/pipeline/runner.ts` — the stage list and the loop that
   drives them; then pick one stage file (`src/pipeline/stages/classify.ts` is a good, compact
   example of the async-work-outside-transaction pattern every LLM/OCR-touching stage uses).
4. `src/worker/main.ts` — the actual process entrypoint; shows the two-phase config load and how
   polling/scheduling/resume fit together.
5. `src/web/context.ts` — the equivalent entrypoint for the `web` process; then any file under
   `app/` for a concrete read/write example.
6. `docs/plan.md` — the slice-by-slice build log, with far more implementation detail per slice than
   this document; treat it as the detailed changelog this document summarizes.
