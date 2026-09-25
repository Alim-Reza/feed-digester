# Improvements (post-V0)

Ideas deliberately deferred from V0. Each entry notes where it came from.

- **Phone / remote access to the dashboard.** Needs authentication plus either a tunnel (Tailscale/Cloudflare Tunnel) or a remote DB (Supabase). Source: grill I2, J6.
- **Weekly / rolling digests** ("this week in AI"). Source: grill A4.
- **Job market trends over time** (skills and roles by week). Source: grill G6.
- **Topics that carry across digests** (running stories). Source: grill H2.
- **Run on a VPS / another machine.** Needs a virtual display + noVNC for manual checkpoint solving, Docker, and thought about datacenter-IP risk. Source: grill J15.
- **Training on feedback.** Use stored 👍/👎 and category corrections to tune thresholds or fine-tune the classifier. Source: grill D6.
- **Engagement-bait / low-effort AI-post filter.** Source: grill D7.
- **Eve agent: "chat with my digests".** An Eve agent that answers questions over stored digests and posts ("what did people say about agents this week?"). Source: grill part 2, Q1.
- **Revisit the Workflow SDK when moving to Postgres/Supabase.** Its Postgres world would give durable execution without our own runner. Source: grill part 3, correction.
- **Personal relevance profile.** Fill in the `profile` config field so relevance is scored against your role, stack, and goals. Source: grill part 2, Q3.
