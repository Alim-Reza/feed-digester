# ADR 0003: Classifier bake-off — Laya vs. gemma4 batches

## Status

Decided (2026-09-25).

## Context

The spec suggests Laya (`@receptron/laya`) or "another lightweight local
classifier" for cheap classification and relevance scoring. Laya's own authors
report 0.36 zero-shot accuracy with no fine-tuning, and the project is one
week old at the time of writing. Picking it on faith would contradict the
spec's own instruction to challenge weak assumptions before coding.

## Decision

Both a Laya-based classifier and a gemma4 batched-prompt classifier were built
behind the same `Classifier` interface (`src/services/classification/`).

Rather than hand-labeling ~150 posts against a fixed rubric, the bake-off ran
both classifiers over 101 real collected posts (`pnpm compare:classifiers` →
`data/classifier-comparison.json`, gitignored since it's real LinkedIn
content) and handed the side-by-side JSON to an external judge model, which
read every post's actual text alongside both classifiers' raw output. Full
verdict: `bake-off-verdict.md` (repo root, not committed — same reason).

**Findings:**

- **Category accuracy: gemma4 wins clearly.** The two classifiers disagreed
  on the primary category for 44 of 101 posts, and gemma4's call was
  consistently the more semantically accurate one — e.g. a DSA-interview-prep
  post: Laya called it `software_engineering`, gemma4 correctly called it
  `career`. Laya's category scores also looked "compressed" — moderately high
  across several unrelated categories at once on the same post (e.g.
  `0.75 SWE / 0.68 AI / 0.54 career / 0.54 leadership / 0.63 industry_news`
  on one post), versus gemma4's sharper, more interpretable distributions.
- **Relevance calibration: Laya wins clearly, gemma4 loses badly.** Asked
  directly for a 0–1 "relevance" number, gemma4 was far too generous: mean
  0.791 vs. Laya's 0.581, and 65/101 posts scored ≥0.8 vs. Laya's 1/101. A
  one-line complaint post got `career / 0.8` from gemma4; Laya scored the
  same post ~0.22 — much closer to how it should actually filter.

**Decision: use gemma4 for category classification, but never trust its own
relevance number.** Instead, `gemmaClassifier.ts` no longer asks the LLM for
a "relevance" field at all — relevance is computed deterministically as a
weighted sum of gemma4's own per-category confidence scores
(`computeWeightedRelevance`, `src/services/classification/relevance.ts`),
weighted by the new `config.classification.relevanceWeights` (one weight per
configured category, normalized by their sum). This keeps gemma4's category-
accuracy advantage while removing its worst failure mode.

Laya's implementation is kept, untouched, behind the same interface — not
deleted, just no longer the default (`classification.active: 'gemma4'`).
Re-enabling it, or re-running the bake-off with a different post sample, is
still a one-line config change, per the point of building both behind one
interface in the first place.

## Consequences

- **Winning classifier:** gemma4 (`classification.active: 'gemma4'`).
- **Category accuracy:** gemma4 clearly better — see findings above; no
  formal precision/recall table, since the bake-off used an external judge
  over raw disagreements rather than `evaluate-classifiers.ts`'s labeled-set
  metrics (nobody hand-labeled the 150 posts that script expects — it's still
  there and still works if that changes).
- **Relevance:** gemma4's own relevance number is unused. Replaced with
  `computeWeightedRelevance` over its category scores — see
  `digest.config.ts`'s `classification.relevanceWeights` for the actual
  weights in effect (defaults favor `software_engineering`/`ai_ml`, per this
  reader's stated interests, non-zero everywhere so no category gets
  silently zeroed out of the digest).
- **Runtime/memory cost:** not formally measured (the bake-off ran once,
  serially — Laya's ~1.7GB ONNX model, then released, then gemma4 via
  Ollama). Laya's own published numbers (~2GB RAM, ~140ms per 3-question
  query on Apple Silicon) still stand as the reference if it's re-enabled.
- **Laya kept as a fallback**, not removed — the interface exists precisely
  so this remains a config change, not a rewrite.
