I want to change the PRODUCT BEHAVIOR of this application.

Do not start by changing the UI.

First inspect the existing repository and understand the current ingestion, classification, summarization, persistence, and digest-generation pipeline.

Relevant existing documentation includes:

- README.md
- ARCHITECTURE.md
- AGENTS.md
- CLAUDE.md
- spec.md
- plan.md
- improvement.md
- grill-section.md
- grill-section-part2.md
- grill-section-part3.md
- bake-off-verdict.md

Also inspect:
- source code
- tests
- prompts
- schemas
- database models
- generated digest structure

CURRENT PROBLEM

The system technically works.

It collects LinkedIn posts, classifies them into categories, and summarizes them.

But the output is not valuable enough.

For example, it currently produces content like:

"Mastering software engineering requires a structured approach..."

or:

"The AI era requires significant shifts in engineering workflows..."

These are technically correct summaries, but they contain very little useful information.

The current system behaves approximately like:

LinkedIn posts
→ classify by topic
→ group by category
→ summarize category

That is NOT the product I want.

NEW PRODUCT MODEL

I want:

LinkedIn posts
→ determine relevance
→ remove noise
→ detect duplicates / overlapping ideas
→ cluster related posts
→ evaluate novelty and usefulness
→ extract concrete insights
→ rank insights
→ produce a finite personal briefing

The goal is:

"After reading these LinkedIn posts so I do not have to, what are the few things actually worth adding to my mental model?"

The product should protect the user's attention.

It should NOT attempt to preserve every post.

It should be comfortable throwing away low-value content.

==================================================
1. POST EVALUATION
==================================================

Each candidate post should be evaluated for dimensions such as:

- relevance
- novelty
- specificity
- actionability
- credibility / signal quality
- career relevance where applicable

Do not blindly expose numeric scores to the UI.

Scores can exist internally.

Possible conceptual model:

usefulness =
  relevance
  + novelty
  + specificity
  + actionability
  + credibility

Determine an appropriate implementation based on the current architecture.

Do NOT blindly implement this exact weighting without analyzing the project.

==================================================
2. AGGRESSIVELY REMOVE LOW-VALUE CONTENT
==================================================

Posts should be allowed to disappear from the digest.

Examples of low-value content:

- generic motivation
- vague career advice
- engagement bait
- generic "keep learning" advice
- obvious observations
- promotional posts with no useful technical content
- reposts saying essentially the same thing
- broad AI hype without a concrete claim
- content the target user is very likely to already know

For example:

"Making significant personal improvements is possible through focused self-work."

This should probably NOT survive into the final briefing.

==================================================
3. NOVELTY
==================================================

Introduce the concept of novelty.

Ask:

"Would a reasonably experienced software engineer likely learn something concrete from this?"

Low novelty examples:

- keep learning continuously
- DSA is important for interviews
- AI is changing software engineering
- communication is important for leadership

Higher novelty examples:

- a concrete technique
- a specific architectural pattern
- an interesting tradeoff
- a practical workflow
- a new tool
- a disagreement between practitioners
- an unexpected engineering lesson
- a specific hiring signal
- a useful job opportunity

==================================================
4. CLUSTER IDEAS, NOT JUST CATEGORIES
==================================================

If several posts discuss the same idea, combine them into one insight.

Example:

Three different posts may discuss:

- multi-agent cognitive overhead
- coordinating agents
- agent orchestration

Instead of showing three separate summaries, generate:

"One coordinating agent may reduce multi-agent cognitive overhead"

Then attach the three source posts.

Categories should remain metadata such as:

AI / Agents

but categories should NOT be the primary summarization unit.

==================================================
5. INSIGHT EXTRACTION
==================================================

For each surviving insight, produce structured data similar to:

{
  "title": "...",
  "summary": "...",
  "whyItMatters": "...",
  "category": "...",
  "sourcePostIds": [...],
  "authors": [...],
  "sourceUrls": [...],
  "suggestedAction": "...",
  "novelty": "...",
  "relevance": "...",
  "confidence": "..."
}

Adapt this structure to the project's existing types and architecture rather than forcing it literally.

"title"

Should state the actual insight.

BAD:
"AI and Software Engineering"

GOOD:
"One coordinating agent may reduce the cognitive cost of managing multiple coding agents"

"summary"

Explain the concrete claim/idea.

Avoid generic category summaries.

"whyItMatters"

Explain why this insight deserves the user's attention.

This should eventually support personalization.

"suggestedAction"

Optional.

Examples:

- Save for later
- Try this workflow
- Read source
- Relevant for interview prep
- Investigate tool
- Apply to project architecture

Do not force an action when none exists.

==================================================
6. PERSONAL RELEVANCE
==================================================

Design the system so relevance can be evaluated against a small user profile.

Example configuration:

interests:
  - agentic software development
  - Java/backend engineering
  - distributed systems
  - system design
  - AI engineering
  - senior/staff engineering

goals:
  - become AI-native
  - grow toward staff/principal engineering
  - find strong remote engineering opportunities

already_familiar_with:
  - generic DSA advice
  - generic career motivation
  - basic microservices concepts

Do NOT hardcode this exact profile unless appropriate.

Determine how profile/configuration should integrate cleanly with the existing local-first architecture.

==================================================
7. FINAL BRIEFING
==================================================

Instead of generating long category summaries, generate something like:

Briefing metadata:

- posts scanned
- posts considered useful
- posts filtered as noise
- duplicate/overlapping posts merged
- estimated reading time

Then:

TOP SIGNALS

Rank approximately 5–10 insights across all categories.

Example:

1. One coordinating agent may be easier to supervise than many independent agents

Summary:
Managing several autonomous coding agents can introduce substantial cognitive overhead. Multiple sources suggest that one coordinating agent delegating bounded work may create a more manageable review process.

Why this matters:
Relevant to agentic IDE and multi-agent software development workflows.

Sources:
3 posts

Category:
AI / Agents

Then continue with the next insight.

The user should be able to understand the important parts of their LinkedIn feed in approximately 3–5 minutes.

==================================================
8. JOB POSTS ARE A SEPARATE PIPELINE
==================================================

Do NOT treat job posts as ordinary prose summaries.

For every useful job post extract structured data such as:

- company
- role
- location
- remote / hybrid / onsite
- experience requirements
- technologies
- seniority
- relevant requirements
- original LinkedIn URL
- author/recruiter if available

Potentially also:

- why this role may be relevant
- obvious skill gaps

Do not invent missing job information.

Keep unknown values as unknown.

==================================================
9. OUTPUT SHOULD PRESERVE SOURCES
==================================================

Every insight must remain traceable to its original LinkedIn post(s).

A synthesized insight may have:

1 source
or
multiple sources.

Do not generate academic-looking citations such as:

[1][2][3]

The data layer should instead clearly associate the insight with source objects.

==================================================
10. PROMPTING STRATEGY
==================================================

Inspect the current prompts.

Avoid prompting an LLM with:

"Summarize these posts."

The synthesis prompt should conceptually ask:

"After reading these posts so the user does not have to, identify only the claims, techniques, opportunities, disagreements, or ideas worth adding to their mental model."

Explicitly tell the model to discard:

- motivational filler
- generic advice
- repeated ideas
- promotional wording
- obvious statements
- low-information content

Prefer information loss over retaining noise.

==================================================
11. DO NOT OVERENGINEER
==================================================

This is a local-first personal tool.

Do not introduce:
- unnecessary distributed systems
- unnecessary databases
- unnecessary queues
- new frameworks without justification
- complex ML infrastructure

Use the existing architecture where possible.

Prefer simple deterministic preprocessing plus LLM judgment where appropriate.

==================================================
12. IMPLEMENTATION PROCESS
==================================================

Before coding:

1. Inspect the existing implementation.
2. Explain the current pipeline.
3. Identify exactly where the current generic summaries originate.
4. Identify what can be reused.
5. Identify what needs to change.
6. Propose the smallest coherent architecture change.

Then create/update an implementation plan.

Do not immediately rewrite the whole system.

Preserve ingestion/storage/classification pieces that remain useful.

Likely focus areas are:

classification
→ filtering
→ scoring
→ deduplication
→ clustering
→ insight extraction
→ ranking
→ briefing generation

==================================================
13. TESTING
==================================================

Create representative fixtures/tests covering cases such as:

A. Generic motivational post
Expected:
filtered

B. Three posts expressing substantially the same idea
Expected:
one synthesized insight with three sources

C. Specific useful technical post
Expected:
survives filtering and produces a concrete insight

D. Generic "AI is changing everything" post
Expected:
low novelty / filtered

E. Job posting
Expected:
structured job extraction

F. Missing job fields
Expected:
unknown/null values, never hallucinated

G. Interesting post from a less relevant category
Expected:
can still rank highly if novelty/usefulness is strong

H. Highly relevant but obvious content
Expected:
relevance alone should not guarantee inclusion

==================================================
14. SUCCESS CRITERIA
==================================================

The implementation is successful when:

- 40 posts do not automatically become 40 things to read
- generic content disappears
- repeated ideas are merged
- the final digest contains specific ideas rather than broad category summaries
- sources remain traceable
- jobs are structured
- the user can consume the important information in approximately 3–5 minutes
- the output clearly answers:

"What did I learn today?"

rather than:

"What topics appeared in my LinkedIn feed?"

==================================================
IMPORTANT

Before implementing, challenge this design.

If something in the existing architecture suggests a better solution, explain it.

Do not blindly follow every proposed field or scoring formula.

Preserve the PRODUCT INTENT:

Reduce attention spent on LinkedIn while maximizing useful information retained.

Then propose the implementation plan and wait for review before making major architectural changes.