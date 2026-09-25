@AGENTS.md

# feed-digester

A local-first LinkedIn feed digester. Full spec: `docs/spec.md`. Approved
architecture: `docs/architecture.md` (why, in `docs/decisions.md`). Rationale
for the big departures from the spec: `docs/adr/`. Slice-by-slice progress:
`docs/plan.md`.

## Ground rules

- **Two processes share one SQLite database**: `web` (Next.js, reads +
  enqueues `run_commands` only) and `worker` (the only writer of pipeline
  data). Never put pipeline logic — Playwright, inference, batch processing —
  inside a Next.js route handler or server action.
- **No orchestration framework.** The pipeline runner in `src/pipeline/` is a
  plain deterministic state machine over SQLite rows (ADR 0002), not Eve or
  any workflow SDK (ADR 0001).
- **16 GB memory budget.** Stages run one at a time, never concurrently:
  close Chrome before classification, release Laya before any Ollama call,
  call Ollama with `keep_alive: 0` at the end of each LLM stage.
- **Collector stays read-only.** No stealth/fingerprint spoofing, no CAPTCHA
  solving, no click other than "see more". This is a hard constraint from
  `docs/spec.md`, not a style preference.
- **Classifier and LLM provider are interfaces, not concrete choices.**
  `Classifier` (`src/services/classification/`) and `LLMProvider`/`Embedder`
  (`src/llm/`) must stay swappable — see ADR 0003 for why Laya isn't assumed
  to win.
- **Citations are validated, never trusted.** Any LLM output with bullets
  must cite existing source numbers; reject and retry otherwise (plan §3.1).
- **Slices run in sequence without stopping for review** (grill K5). Each
  slice ends with `pnpm lint && pnpm test && pnpm build` passing and an
  updated `docs/plan.md`.

## Commands

`pnpm dev` (web + worker once slice 2 lands), `pnpm build`, `pnpm test`,
`pnpm lint`, `pnpm typecheck`, `pnpm format`.
