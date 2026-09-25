# Decisions

Major decisions extracted from `docs/spec.md`, the `docs/grill/grill-section*.md` back-and-forth,
`docs/adr/`, and what actually shipped. Grill IDs (e.g. "B3/Q8") let you trace a decision back to
its original question; `docs/plan.md`'s per-slice notes have the implementation-time detail behind
most of these. Where the shipped code differs from what was decided on paper, that's called out
explicitly rather than smoothed over.

## 1. Orchestration: no Vercel Eve

**Problem.** `docs/spec.md` asked for Vercel Eve to orchestrate collection through digest generation,
with durable execution, scheduling, and retry/resume.

**Options considered.** (a) A plain deterministic pipeline, Eve-free. (b) Eve as specified — an
LLM agent that decides which tool to call next, backed by the Workflow SDK.

**Chosen.** (a). Documented in `docs/adr/0001-no-eve.md`.

**Rationale.** Two problems with Eve as specified, found during research (grill part 2 §1.2):
Eve's durability unit is "one LLM call plus its tool calls" — there's no way to express a fixed
code pipeline in it, so every stage transition would cost an LLM call for a decision that's
always the same. And the Workflow SDK's local world holds its step queue in memory only
("designed for development, not production" — a crash loses all progress); real durability needs
a Postgres world, which is disproportionate infrastructure for a single-user local tool.

**Tradeoffs.** Gave up Eve's built-in scheduling/durability/retry primitives in exchange for
writing them by hand (ADR 0002). Gained: zero extra infrastructure, no LLM latency/cost on every
stage transition, a fully deterministic and testable stage order.

**Where.** `src/pipeline/`, `src/worker/`. Eve is deferred to `docs/improvements.md` as a future _"chat
with my digests"_ agent — a role where letting an LLM choose between tools is actually the point.

## 2. Durability: a SQLite-backed pipeline runner

**Problem.** Given decision 1, something still needs to provide resumable, idempotent, retryable,
logged processing across multiple stages, running unattended once a day, restartable at any
point, on a single Mac.

**Options considered.** (a) Roll a small state machine on top of the same SQLite database
already in use. (b) A dedicated queue/workflow library. (c) The Workflow SDK's Postgres world.

**Chosen.** (a). `docs/adr/0002-sqlite-pipeline-runner.md`, confirmed in grill part 3, Q17.

**Rationale.** No new infrastructure; SQLite is already the system's database. Batches that
commit their output and status transition in one transaction give idempotency "for free" — a
crash mid-run leaves already-committed work done and the rest untouched, no separate crash-
recovery logic needed.

**Tradeoffs.** Single-writer constraint bounds throughput to one worker process — acceptable at
this scale (hundreds of posts/day) and matches the memory budget's own "one stage at a time"
constraint. **Verified discrepancy**: the ADR's written decision says batches "retry with
exponential backoff, up to 3 attempts." The shipped code (`posts.recordAttemptFailure`,
`src/db/repositories/posts.ts`) implements the 3-attempt cap but no backoff calculation exists
anywhere in the source — a failed post is just retried whenever its stage is next entered by any
run, scheduled or manual.

**Where.** `src/pipeline/runner.ts`, `src/pipeline/batch.ts`, `src/db/repositories/runs.ts`,
`src/db/repositories/posts.ts`.

## 3. Collector: read-only, human-paced, on a separate account

**Problem.** Automating a LinkedIn session risks account restriction and violates LinkedIn's
Terms of Service outright, regardless of how it's implemented.

**Decision** (grill B1/B2/B3, confirmed in README.md's own warning banner). Strictly read-only:
no automated likes, comments, follows, or connection requests, and the only click ever performed
is "see more" to expand already-visible text. No anti-bot evasion — no stealth plugins, no
fingerprint spoofing, no CAPTCHA solving. Paces itself like a person (randomized scroll/pause
timing, a capped session length and posts-per-run, a daily run cap) and stops the moment it sees
a checkpoint or login wall, pausing the run for a human to solve it by hand (grill B3/Q8: up to
`checkpointWaitMinutes`, default 15, before saving what it has and moving on).

**Rationale.** None of this makes the tool compliant with LinkedIn's ToS — the user explicitly
accepted that risk for a _secondary_ account (grill B1), with the main account only used for
initial setup.

**Tradeoffs.** Read-only means no way to auto-dismiss a checkpoint — a human has to be available
within the wait window, or that day's run just saves what it already collected and stops.

**Where.** `src/collector/pacing.ts`, `stopConditions.ts`, `detection.ts`, `scroller.ts`.

## 4. Collector parsing: ARIA selectors, not CSS classes

**Problem.** The original collector parser was written from training-data knowledge of
LinkedIn's markup (`feed-shared-*`/`update-components-*` class names). On a real capture
(slice 3), it matched **zero** posts.

**Finding.** As of 2026-09-25, LinkedIn's feed renders through a server-driven UI system with
fully hashed, atomic CSS classes and no stable `data-urn` on post containers — there is nothing
meaningful left to select on by class name.

**Chosen.** Rebuilt around ARIA roles and attributes instead: post containers are
`[role="listitem"]` filtered to ones with real post text or a recognizable control (a "Hide post
by "/"Open control menu for post by " `aria-label`), deduped to the outermost match so nested
comment listitems aren't double-counted. Author name comes from that control's `aria-label`;
post text from `[data-testid="expandable-text-box"]`.

**Consequence, not originally planned.** There is no reliable post-level URN anymore. Most posts
fall back to hash-based dedup instead of exact URN dedup — a real deviation from the original
plan, discovered and documented rather than papered over.

**Where.** `src/collector/parse/`, `tests/fixtures/linkedin/` (40 fixtures: 7 from a real
capture, 33 synthetic for shapes the one real session didn't happen to show).

## 5. UI stack: shadcn/ui on Base UI, not Radix

**Problem.** Grill I5 asked for shadcn/ui with dark mode. By the time slice 10 ran, the shadcn
CLI's current output targeted a different underlying primitives library (`@base-ui/react`) and a
different theming convention (Tailwind v4 CSS-first config, a published `cn` package instead of a
local `lib/utils.ts` re-export) than what "shadcn/ui" commonly means from older training data.

**Chosen.** Used the CLI's actual current output as-is rather than hand-rolling an older-style
setup. Dark mode is class-based (`.dark` on `<html>`), applied via a `next/script`
`beforeInteractive` snippet reading `localStorage`/OS preference before hydration, so there's no
flash; the toggle itself uses a CSS `dark:` variant instead of React state, avoiding both a
hydration mismatch and the `react-hooks/set-state-in-effect` lint rule.

**Where.** `components.json`, `components/ui/`, `components/theme-toggle.tsx`, `app/globals.css`.

## 6. Web writes: Server Actions only, nothing else

**Problem.** `web` needs to trigger runs and edit config/feedback without becoming a second
writer of pipeline data (CLAUDE.md's ground rule; ADR 0002's single-writer design).

**Chosen.** Every mutation from `app/` is a `'use server'` Server Action that calls exactly one
narrow repository method — `repos.runCommands.enqueue`, `repos.settings.set`, or
`repos.feedback.add` — never a pipeline-data write. Forms are plain HTML `<form action={...}>`
bound to these actions (no client-side JS needed for the mutation itself), following Next's own
"validate inputs, treat FormData as untrusted" guidance.

**Tradeoffs / hardening found during this**: the settings forms originally wrote raw, unvalidated
`FormData` straight into the `settings` table. Fixed by validating every write against the same
Zod schema `loadSettingsOverrides` uses on read, so a bad submission is simply not persisted
instead of silently vanishing later.

**Where.** `app/operations/actions.ts`, `app/posts/actions.ts`.

## 7. Config overrides: read once at startup, not live

**Problem.** Grill I1/J13 asked for UI-edited settings to override the file defaults. The
mechanism (the `settings` table) existed since slice 1, but nothing ever actually read it back
until slice 11 — `loadConfig()` was always called with no overrides.

**Chosen.** `loadSettingsOverrides` (`src/config/settingsOverrides.ts`) builds `loadConfig`'s
override argument from the `settings` table, one row per top-level config key, read **once** at
process startup in both `worker/main.ts` and `web/context.ts`. A setting saved through the UI
takes effect on the next restart, not mid-run.

**Rationale for the scope limit.** Nothing in the pipeline re-reads config once a run starts;
adding live reload would mean threading config through every in-flight stage call, for a benefit
(same-run reactivity) nobody asked for.

**Hardening found here**: a malformed `settings` row (bad manual edit, a future migration, or a
writer bug) would make `digestConfigSchema.parse()` throw and crash the _entire_ process on its
next startup, with no obvious cause and no recovery short of editing the SQLite file directly.
Fixed by validating each row against its own field's schema before trusting it — an invalid row
is dropped with a logged warning, falling back to the file default for that section.

**Where.** `src/config/settingsOverrides.ts`, `src/worker/main.ts`, `src/web/context.ts`.

## 8. Retention: purge by completed-run cycles, not by wall-clock age

**Problem.** Grill B4/Q7 asked for raw post content deleted after N cycles, where "a cycle is a
completed run," keeping categories/scores/job rows/digest summaries so old digests' citations
still resolve.

**Chosen.** The purge cutoff is the `finishedAt` timestamp of the Nth-most-recent `succeeded` run
(`retention.keepCompletedRuns`) — nothing purges until that many runs have ever succeeded, so a
fresh install never purges anything. Debug HTML snapshots (no DB row to join against) are purged
by parsing the timestamp already embedded in their own filename.

**Verified discrepancy.** Grill part 3's written decision states "Default N = 7." The shipped
config (`digest.config.ts`) sets `retention.keepCompletedRuns: 14`. Not changed in this session —
noted as a fact, not corrected, since there's no evidence for which value is actually intended.

**Where.** `src/pipeline/stages/retention.ts`.

## 9. Classifier bake-off: gemma4, with its relevance number replaced

**Problem.** ADR 0003: the spec suggested Laya "or another lightweight local classifier" on
faith, with Laya's own authors reporting 0.36 zero-shot accuracy. Something had to actually
compare it against the alternative (a gemma4 batched-prompt classifier) before picking a default.

**Options considered for _how_ to run the bake-off.** (a) Hand-label ~150 posts in `/posts`
against a fixed rubric, then run `evaluate-classifiers.ts` for precision/recall/F1 (the original
plan, grill E5). (b) Dump both classifiers' raw predictions over real collected posts and have an
external model judge the comparison directly, with no ground truth at all.

**What actually happened.** (b) — nobody labeled 150 posts; `pnpm compare:classifiers` (built for
this) dumped 101 real posts' worth of both classifiers' output to JSON, an external LLM judged
it, and the verdict (`docs/bake-off-verdict.md`) became the decision. (a) still exists and still
works — it's just unused.

**Verdict, verified against `docs/bake-off-verdict.md`.** gemma4 clearly more accurate on category
(44/101 primary-category disagreements, gemma4 consistently more semantically correct). gemma4's
own relevance number badly miscalibrated — mean 0.791 vs. Laya's 0.581, 65/101 posts scored ≥0.8
vs. Laya's 1/101. Laya's category scores also looked "compressed" (moderately high across several
unrelated categories on the same post at once).

**Chosen.** `classification.active: 'gemma4'`, but gemma4 is never asked for its own relevance
number anymore — `computeWeightedRelevance` (`src/services/classification/relevance.ts`) derives
relevance deterministically from gemma4's own per-category confidence scores, weighted by
`classification.relevanceWeights` (one weight per category, non-zero everywhere so nothing is
silently zeroed out of the digest). Laya's implementation is untouched, kept behind the
`Classifier` interface, not deleted — re-enabling it is a one-line config change.

**Where.** `docs/adr/0003-classifier-bake-off.md`, `digest.config.ts`,
`src/services/classification/{gemmaClassifier,relevance}.ts`.

## 10. Scheduler retry-storm fix (found live, post-launch)

**Problem.** `stopConditions.maxRunsPerDay` was declared in config from slice 0 — grill B2/Q5's
explicit "caps on session length and runs per day," an anti-hammering measure, not just a
performance one — but never actually enforced anywhere in code. A live repro: a stale Chrome
`SingletonLock` file made `collect` fail in about a second, and with nothing capping retries, the
scheduler (checked every 60s) fired 10+ `scheduled` runs in under an hour.

**Chosen.** `checkSchedule` now checks a new `runs.countStartedSince('scheduled',
startOfLocalDay)` against `maxRunsPerDay` before starting another attempt; once the cap is hit
for the day, it waits for tomorrow regardless of how many attempts failed.

**Where.** `src/worker/scheduler.ts`, `src/db/repositories/runs.ts`.
