# Architecture

Full rationale lives in `docs/adr/` and `docs/decisions.md`; `docs/project-memory.md`
has the fuller architecture writeup this file is the short version of.
(The originally-approved plan doc no longer holds separate content — it was
lost to a case-insensitive-filesystem collision; see the warning at the top
of `docs/plan.md`.)

## Two processes, one database

- **`web`** (Next.js, `app/`) never runs pipeline work. It inserts rows into
  `run_commands` and reads everything else for the dashboard.
- **`worker`** (`src/worker/`) is the only process that writes pipeline data.
  It polls `run_commands`, runs the scheduler, and drives the pipeline runner.
  It runs one run at a time, enforced by a lock row.
- Both open the same SQLite file (`data/*.sqlite`) in WAL mode, so the UI can
  read while the worker writes. See ADR 0002.

There is no orchestration framework (Eve, a workflow engine, a queue) — see
ADR 0001. The pipeline's stage order is fixed and lives in `src/pipeline/`.

## Pipeline stages

`collect → ocr → filter → classify → extract-jobs → cluster → summarize →
digest → retention`, each idempotent and resumable — see ADR 0002 and
`docs/project-memory.md`'s stage-by-stage summary.

## Interfaces meant to be swapped

- `Classifier` (`src/services/classification/`) — Laya and a gemma4-batch
  implementation both exist behind this; ADR 0003 picked gemma4 after a
  bake-off (2026-09-25). Laya's implementation is unchanged, just not the
  default — switching back is a config change.
- `LLMProvider` / `Embedder` (`src/llm/`) — Ollama is primary, Groq an
  optional fallback (`FallbackLLMProvider`), both behind the same interface.
- `Collector` parsing (`src/collector/parse/`) — pure functions from HTML to
  `PostDraft`, isolated from the live Playwright session so they can be
  tested against saved fixtures (`tests/fixtures/linkedin/`).

## Memory budget (16 GB Mac)

Stages run one after another, never concurrently: Chrome is closed before
classification starts, a classifier/embedder/LLM provider is released before
the next one is created, and Ollama is called with `keep_alive: 0` at the end
of each LLM stage.

## Directory layout

See `docs/project-memory.md`'s "Where to start reading code" for the real
tree and the reasoning behind each directory, including which
`src/services/*` subdirectories are empty scaffold remnants.
