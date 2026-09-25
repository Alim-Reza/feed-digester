# ADR 0001: No Vercel Eve — a deterministic pipeline runner instead

## Status

Accepted

## Context

`spec.md` calls for Vercel Eve to orchestrate the pipeline: durable execution,
scheduling, and retry/resume across collection, filtering, classification, job
extraction, clustering, summarization, and digest assembly.

In Eve, an LLM decides which tool to call next, and durability is provided by
the underlying Workflow SDK. Two problems follow from that:

1. **Every "next step" decision becomes a model call.** The pipeline's stage
   order (collect → ocr → filter → classify → extract-jobs → cluster →
   summarize → digest) is fixed and never needs to vary at runtime. Paying for
   an LLM decision at each transition adds latency and cost for no benefit,
   and makes the order less predictable than a plain state machine.
2. **The Workflow SDK's durability depends on Postgres.** Run locally without
   it and the step queue lives in memory — a crash mid-run loses progress.
   Standing up Postgres purely to get durability for a single-user, local-first
   tool is disproportionate.

## Decision

V0 uses a deterministic pipeline runner (ADR 0002) that stores run and
per-post progress in the same SQLite database as everything else. Stage order
is code, not model output.

Eve is deferred to `improvement.md` as a _"chat with my digests"_ agent — a
role where letting an LLM choose between tools (search posts, re-summarize a
cluster, explain a drop reason) is actually the point, unlike the fixed
processing pipeline.

## Consequences

- The pipeline is deterministic and cheap to run repeatedly; inference is only
  ever spent on classification, extraction, and summarization — the tasks
  that need it.
- Durability, resume, and retry are the runner's own responsibility (ADR
  0002), not delegated to a workflow framework.
- If a conversational "ask your digest" feature is built later, it can adopt
  Eve (or any agent framework) as a separate, additive layer that reads the
  same SQLite database — it does not need to replace the runner.
