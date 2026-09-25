# Session Handoff

For picking this project back up — a fresh LLM coding session or a human. Written 2026-09-25,
end of the session that implemented slices 7-12, ran the ADR 0003 classifier bake-off, and fixed
a scheduler bug found live. Read `docs/project-memory.md` first for the architecture; this doc is
state and next steps, not a tutorial.

## Current state

- All 12 slices from `docs/plan.md` §6 are done. `pnpm lint && pnpm test &&
pnpm build` pass — 272 tests across 42 files.
- ADR 0003 is **decided**: `classification.active: 'gemma4'` in `digest.config.ts`, with
  relevance computed from category scores (`relevanceWeights`) instead of trusting gemma4's own
  relevance number. See `docs/adr/0003-classifier-bake-off.md` and `docs/decisions.md` §9.
- `ollama pull embeddinggemma` is done (needed for the `cluster` stage's embeddings).
- `pnpm login` has been run once; the `main` Chrome profile is logged in.
- A scheduler bug (unbounded retry on a failing scheduled run) was found live and fixed —
  `docs/decisions.md` §10.
- There is **no git history** — zero commits, by deliberate choice (grill K1/K2: "don't bother
  with git now"). If this project gets a git repo, this is a natural point to make the first
  commit; there's a full, working tree to commit as-is.
- `git diff`/`git log` were not usable during this session's own audit for exactly this reason —
  "verify against the code" meant reading source files directly, not diffing against history.

## Important files (beyond what `docs/project-memory.md` already covers)

- `digest.config.ts` — read this before changing any behavior; it's the single source of truth
  for every threshold, weight, and toggle.
- `docs/plan.md` (used to collide with `plan.md` under a different case on this filesystem — see
  the warning at its own top) — the detailed, slice-by-slice changelog. More implementation detail
  lives there than in any other doc.
- `docs/bake-off-verdict.md` and `data/classifier-comparison.json` — both gitignored (derived from
  real LinkedIn content). If either is missing, the bake-off can be re-run with `pnpm
compare:classifiers` (no ground truth needed) or `pnpm evaluate:classifiers` (needs labels in
  `/posts` first).

## Invariants — do not break these without a deliberate decision

- **One stage runs at a time, never concurrently** (16GB memory budget). Chrome closes before
  classification starts; a `Classifier`/`Summarizer`/`Embedder` is released (`.release()`) before
  the next one is created, and Ollama is called with `keep_alive: 0` at the end of each LLM
  stage.
- **`web` never writes pipeline data.** Every mutation in `app/` goes through exactly one of
  `repos.runCommands.enqueue`, `repos.settings.set`, or `repos.feedback.add`. If you add a new
  Server Action, it must be one of these, or the two-process boundary is broken.
- **A stage's `run()` must commit each batch's writes and status transition in one transaction**
  (`runBatchLoop` for synchronous stages; the async-work-outside-transaction-then-commit pattern
  in `ocr.ts`/`classify.ts`/`extractJobs.ts` for stages that call an LLM/OCR/embedder). This is
  the entire idempotency mechanism — breaking it breaks crash-resume.
- **LLM-generated content with citations must be validated, never trusted.** Any bullet with
  `sources` must be checked against the sources actually given before being written to the DB
  (`summarizer.ts`, `gemmaClassifier.ts`, `extractor.ts` all do this with a local retry loop).
- **Settings overrides are read once per process, not live.** Don't add a "live reload" shortcut
  without also deciding whether an in-flight run should pick up a config change mid-stage —
  right now, deliberately, it never does.
- **New routes reading DB state must be `export const dynamic = 'force-dynamic'`** or Next.js
  will silently prerender them as static HTML at build time. This bit us once already (`/` and
  `/digests` in slice 10).

## Known issues (see `docs/project-memory.md`'s "Known limitations" for the full verified list)

1. ADR 0002 claims exponential backoff on retry; no backoff exists in code.
2. `relevanceProfile` in config is dead — nothing reads it.
3. `evaluate-classifiers.ts` (the labeled-eval path) is untested against real labels — nobody has
   used `/posts`'s labeling UI yet.
4. Retention's default (14) doesn't match the grill decision's stated default (7) — unresolved,
   not obviously a bug, just a discrepancy.
5. Four empty scaffold directories under `src/services/` (`dedup`, `digest`, `filtering`,
   `retention`) — harmless, but confusing if you go looking for logic that actually lives in
   `pipeline/stages/*.ts` or `posts.insertOrTouch` instead.
6. `.env.example` references a nonexistent `src/llm/fallback.ts` (real file:
   `fallbackProvider.ts`).

## Next logical work

Roughly in order of what would matter most next:

1. **Run a real end-to-end cycle and look at the actual digest.** Everything's been verified in
   isolation (unit tests, targeted smoke tests) but nobody has watched a full `collect → digest`
   run complete against real data with the final `gemma4` classifier and real embeddings. This is
   the highest-value next step — it'll surface whatever the isolated tests can't.
2. **Label ~150 posts in `/posts` and run `pnpm evaluate:classifiers`** to get the originally-
   planned precision/recall numbers, as a second, more rigorous opinion alongside the external-
   judge verdict already in hand.
3. Decide `relevanceProfile`'s fate: wire it into Laya's relevance question (the original grill
   D5 intent) or remove the dead field.
4. Pick something off `docs/improvements.md` — phone access, weekly roll-ups, job-market trends over
   time, training on 👍/👎 feedback, and an Eve "chat with my digests" agent are all explicitly
   scoped out of V0 and sitting there ready to pick up.
5. Consider whether retention's actual default (14) should change to match the grill decision
   (7), or whether the grill decision should just be treated as superseded.
6. First git commit, if/when git history starts mattering.
