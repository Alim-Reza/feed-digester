# Improvements (post-V0)

Ideas deliberately deferred from V0. Each entry notes where it came from.

- **Phone / remote access to the dashboard.** Needs authentication plus either a tunnel (Tailscale/Cloudflare Tunnel) or a remote DB (Supabase). Source: grill I2, J6.
- **Weekly / rolling digests** ("this week in AI"). Source: grill A4.
- **Job market trends over time** (skills and roles by week). Source: grill G6.
- **Topics that carry across digests** (running stories). Source: grill H2.
- **Run on a VPS / another machine.** Needs a virtual display + noVNC for manual checkpoint solving, Docker, and thought about datacenter-IP risk. Source: grill J15.
- **Training on feedback.** Use stored 👍/👎 and category corrections to tune thresholds or fine-tune the classifier. Source: grill D6.
- **Eve agent: "chat with my digests".** An Eve agent that answers questions over stored digests and posts ("what did people say about agents this week?"). Source: grill part 2, Q1.
- **Revisit the Workflow SDK when moving to Postgres/Supabase.** Its Postgres world would give durable execution without our own runner. Source: grill part 3, correction.
- **Cross-category idea merging.** Clustering is still per-category (`services/clustering/cluster.ts`); a genuinely cross-category dedup/merge (e.g. the same idea showing up under both AI/ML and Engineering Leadership) needs a bigger algorithmic change (global embedding space, redefining what a digest row groups by) than the spec-second.md insight redesign attempted. Source: docs/decisions.md §11, challenge #3.
- **Flat, fully ranked briefing UI.** `/digests/[id]` still groups insight cards by category visually even though ranking (`topicClusters.rank`) is now cross-category — spec-second.md explicitly deferred any UI rework. Source: docs/decisions.md §11.

## Done (previously listed here as deferred)

- ~~**Engagement-bait / low-effort AI-post filter.**~~ Done via `filtering.lowValuePhrases` (spec-second.md §2, docs/decisions.md §11). Source: grill D7.
- ~~**Personal relevance profile.**~~ Done via the structured `profile: {interests, goals, alreadyFamiliarWith}` config block, threaded into the insight prompt and the ranking bonus (docs/decisions.md §11). Source: grill part 2, Q3.
