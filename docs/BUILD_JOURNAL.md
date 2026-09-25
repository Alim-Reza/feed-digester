# Build Journal

How `feed-digester` actually got built, reconstructed from `spec.md`, the three rounds of
`grill-section*.md`, `plan.md`/`PLAN.md`'s per-slice notes, `docs/adr/`, and `bake-off-verdict.md`.
Chronological, including the approaches that were tried or proposed and then rejected — those are
as much a part of the record as what shipped.

## 1. The spec

`spec.md` describes a local-first LinkedIn feed digester: Playwright collection through a
dedicated Chrome profile, SQLite storage, Vercel Eve for orchestration, Laya (or "another
lightweight local classifier") for cheap classification, a local LLM via Ollama for
summarization/extraction, Groq as an optional fallback, and a Next.js digest UI. It explicitly
asks the builder to "challenge weak assumptions before coding" — a line that ends up mattering a
lot, since two of the spec's named tools (Eve, Laya) don't survive contact with that instruction
unchanged.

## 2. The grill — three rounds of questions

**Round 1** (`grill-section.md`): intent and usage, risk/compliance (the account-safety
questions that produced decision §3's read-only/separate-account posture), collection behavior,
filtering/classification, the tools the spec named but didn't fully specify (Eve, Laya), local
inference constraints, jobs, clustering/summarization, UI, tech stack, and process. Many answers
were "your call," deferring to the builder's judgment with the expectation of a written rationale.

**Round 2** (`grill-section-part2.md`): research findings that changed the plan materially —

- **The machine**: an M1 Pro with 16GB RAM. `gemma4` alone loads at ~10GB; running it alongside
  Laya, Chrome, and Next.js at the same time doesn't fit. This became the "one stage at a time,
  release before the next" memory-budget rule that touches almost every stage in the codebase.
- **Eve, researched directly**: it's a real, locally-runnable tool, but its durability unit is
  "one LLM call plus its tool calls" — there's no way to express a fixed pipeline in it without
  an LLM deciding the next step every time. Its underlying Workflow SDK's local world holds state
  in memory only, so it wouldn't even give the crash-resume behavior it was chosen for without
  standing up Postgres. This research directly produced ADR 0001's rejection.
- **Laya, researched directly**: real, very new (about a week old at research time), with the
  authors' own benchmark showing 0.36 zero-shot accuracy versus 0.766 fine-tuned — a real risk
  the spec's "challenge weak assumptions" instruction was clearly anticipating. This became
  ADR 0003's whole reason to exist.

Decisions made and written up in round 2 covered most of the remaining open questions: the digest
window (since the last digest, not rolling), category set and sections, the collector's stop
conditions, image handling (OCR, keep if the text looks real, discard otherwise), the retention
policy, clustering approach, UI scope, and the full tech stack (pnpm, Next.js App Router, Drizzle
on SQLite, Zod v4, Vitest with saved-fixture-only collector tests, pino, shadcn/ui with dark
mode).

**Round 3** (`grill-section-part3.md`), short: one correction (the Workflow SDK's local world
doesn't actually durable-resume, contrary to what round 2 had said), the sqlite-backed-runner
decision confirmed, and two remaining questions (Bangla handling, VPS scope) closed out.

## 3. `plan.md` — approved, then destroyed by its own filesystem

A `plan.md` was written and approved before any code, covering the schema, citation-validation
rules, and batch-loop details CLAUDE.md and ARCHITECTURE.md still reference. At some point before
slice 4, a write to the slice-status tracker (`PLAN.md`) silently overwrote that content — macOS's
default filesystem (APFS) is case-insensitive, so `plan.md` and `PLAN.md` are the same file. There
was no git history to recover it from (zero commits at the time, and still zero now). Slice 4 was
implemented from what survived scattered across `ARCHITECTURE.md`, `docs/adr/`, `spec.md`, and the
grill files. `PLAN.md`'s own header now carries a permanent warning about this, and neither file
has been "fixed" (e.g. by renaming the tracker) — a decision purely of scope, not correctness.

## 4. Slices 0-6: scaffold through the LLM layer

Built without stopping for review between slices (grill K5: "just build it"), each ending with
`pnpm lint && pnpm test && pnpm build` passing. In rough order: project scaffold and config
loader; the DB schema and repositories; the pipeline runner and worker process (built before any
stage had real logic, proven with stub stages that just moved posts through every status); the
collector's parser, which found LinkedIn's markup had changed out from under the plan (see below);
the live collector; OCR/filtering/language detection; the LLM provider layer (Ollama primary, Groq
fallback, both behind `LLMProvider`).

**Rejected/changed mid-slice, with evidence:**

- **The collector's original selector-based parser matched zero posts on a real capture**
  (slice 3). LinkedIn had moved to a server-driven UI with fully hashed CSS classes and no
  `data-urn` on post containers — the training-data-informed selectors simply didn't exist
  anymore. Rebuilt around ARIA roles/attributes instead (`docs/DECISIONS.md` §4).
- **Post dedup by exact URN, as originally planned, had to fall back to hash-based dedup for most
  posts** — a direct consequence of the ARIA rebuild: there's no reliable container-level URN in
  the current markup, only an opportunistic one recoverable from a nested comment.
- **The Ollama AI-SDK provider's `keepAlive` option only covers the embedding model, not chat** —
  found while building the LLM layer; `keep_alive: 0` (the memory-budget rule) had to be sent as
  a raw request to Ollama's `/api/generate` instead of through the typed provider API.

## 5. Slices 7-9: classification, jobs, and the digest pipeline

Both classifiers (Laya and gemma4) were built in full before either was picked as the default —
the bake-off (ADR 0003) was always going to be decided after real data existed to test against,
not before. Job extraction was gated by the classifier's own `job` score so most posts never
reach an LLM for extraction at all, matching the spec's explicit "don't send every raw post to a
general-purpose LLM" instruction. Clustering and summarization were built as a single logical
unit spanning three stages (`cluster`/`summarize`/`digest`) since cluster membership is a
collective decision across the whole current batch, not a per-post one — a deliberate departure
from the usual 25-post batch loop used everywhere else.

**A real bug caught during this work**: the `classify` stage's batch loop re-queried posts in
`filtered` status after a failed batch without excluding the ones that batch had just recorded an
attempt-failure for — a broken batch (e.g. Ollama unreachable) would spin through all 3 retry
attempts and land every affected post on `failed` within a single stage run, instead of leaving
it `filtered` for a later run to retry. The same bug, and the same fix, recurred in `extract-jobs`
and was caught by the same pattern of test.

## 6. Slices 10-11: the UI

Built with shadcn/ui's _current_ CLI output rather than an older-style setup remembered from
training data — the CLI now targets Base UI, not Radix, and a different theming convention
entirely (`docs/DECISIONS.md` §5). The first `pnpm build` after the digest pages existed caught a
real bug: `/` and `/digests` were silently prerendered as static HTML at build time, frozen
forever, because nothing told Next.js they read live, request-time database state.

Building `/operations` surfaced that the `settings` table — present since slice 1 — had never
actually been wired into config loading at all; `loadConfig()` had always been called with no
overrides, so grill I1/J13's "edits in the UI override the file" was pure aspiration until this
slice implemented `loadSettingsOverrides`. Building the run-log view (`/operations/runs/[id]`)
surfaced that only the `collect` stage was ever writing to `run_events` — every other stage's
progress only reached pino's logs, invisible to the DB-backed UI grill J11 had actually asked
for. Fixed once, at the pipeline runner level, rather than in all eight stage files individually.

## 7. Slice 12: retention, and two hardening bugs found by re-reading slice 11's own code

Retention shipped as designed against grill B4/Q7. The two hardening fixes in this slice weren't
assigned in advance — they came from reviewing what slice 11 had just built: an unvalidated
`settings` row could crash the entire process on its next startup (fixed with per-field schema
validation on read), and the settings forms wrote unvalidated `FormData` straight to the DB
(fixed with the same validation on write).

## 8. Post-launch: the classifier bake-off, and a bug found live

With all 12 slices done, the actual bake-off ran — not the originally-planned hand-labeled
precision/recall path, but a faster one: dump both classifiers' real output over 101 already-
collected posts and have an external LLM judge the comparison directly. The verdict
(`bake-off-verdict.md`): gemma4 clearly more accurate on category, badly miscalibrated on its own
relevance number. Implemented as `classification.active: 'gemma4'` plus a deterministic
relevance formula over gemma4's own category scores, replacing the LLM-generated relevance number
entirely rather than trying to prompt it into better calibration.

While getting a real pipeline run to actually complete end to end, the scheduler was caught
retry-storming — 10+ failed `scheduled` runs in under an hour, all failing in about a second on a
stale Chrome profile lock. The proximate cause (a leftover lock file from an earlier unclean
exit) was trivial to clear by hand; the real bug underneath it — `stopConditions.maxRunsPerDay`,
declared in config since slice 0 as an explicit anti-hammering measure, never actually enforced
anywhere — was the more consequential find, and the fix (`docs/DECISIONS.md` §10) is what
prevents the next unrelated failure from doing the same thing.
