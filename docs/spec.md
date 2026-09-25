I want to build a local-first LinkedIn feed distillation tool.

## Goal

I do not want to endlessly scroll LinkedIn. I want the system to collect posts from my feed, filter noise, classify useful content, summarize what matters, and produce a finite digest.

The main categories I care about are:

- Software engineering
- AI / ML / agents
- Career advice
- Engineering leadership
- Industry/technical news
- Job openings

For job posts, I do not want to read every post. I want structured information such as:

- Company
- Role
- Location / remote status
- Experience requirements
- Important technologies/skills
- Original LinkedIn post URL

## High-level architecture

Use:

- Playwright + TypeScript for LinkedIn feed collection
- A dedicated persistent Chrome profile that I log into manually
- SQLite initially for persistence
- Vercel Eve as the orchestration/workflow layer
- Laya or another lightweight local classifier for cheap classification/relevance scoring
- A local LLM via Ollama for summarization and structured extraction
- Groq only as an optional fallback when local inference is insufficient
- Next.js for a simple digest UI

Important: Eve should orchestrate the workflow, but core business logic should remain normal reusable TypeScript services and should not become tightly coupled to Eve.

## Collection behavior

The collector should:

1. Open LinkedIn using the dedicated logged-in browser profile.
2. Scroll the feed for a configurable period such as 10–20 minutes.
3. Extract only information already visible to the user.
4. Capture at least:

   - Author
   - Author headline if available
   - Post text
   - Original post URL / ID if available
   - Content type
   - Published time if available
   - Collection timestamp

5. Skip or deprioritize:

   - Sponsored content
   - Videos with little useful accompanying text
   - Connection suggestions
   - Polls
   - Generic personal celebrations

6. Deduplicate posts using LinkedIn post ID/URL when possible, otherwise a normalized hash.

Keep this strictly read-only. Do not add automated likes, comments, follows, connection requests, or anti-bot bypass behavior.

## Processing pipeline

The desired flow is:

Collection
→ Deduplication
→ Cheap deterministic filtering
→ Batch classification
→ Relevance scoring
→ Job extraction where relevant
→ Topic clustering
→ Summarization
→ Final digest

Do not send every raw post to a general-purpose LLM.

Classification should be multi-label, for example:

```json
{
  "software_engineering": 0.91,
  "ai_ml": 0.83,
  "career": 0.2,
  "job": 0.05,
  "irrelevant": 0.03,
  "relevance": 0.89
}
```

Laya/local classifier should handle classification where practical.

The local LLM should handle tasks requiring actual generation or extraction, such as:

- Summaries
- Job requirement extraction
- Cross-post synthesis
- Cluster summaries

## Important optimization

Batch classification.

Example:

300 collected posts
→ 220 unique
→ 140 survive rule filtering
→ classifier identifies 60 relevant
→ clustering reduces them to around 15–25 meaningful topics
→ only those topics require richer LLM summarization

I care more about minimizing unnecessary inference than about real-time speed.

## Eve

Use one main Eve agent/workflow rather than creating an agent for every step.

Conceptually expose tools/services such as:

- collectFeed()
- getUnprocessedPosts()
- classifyPosts()
- extractJobs()
- clusterPosts()
- summarizeCluster()
- generateDigest()
- saveDigest()

Use Eve for:

- Workflow orchestration
- Durable execution
- Scheduling
- Retry/resume behavior
- Calling tools/services

Do NOT put all business logic directly inside Eve-specific code.

Keep services independently callable and testable.

## Suggested project structure

```text
linkedin-digest/
├── app/
│   └── Next.js dashboard
│
├── src/
│   ├── collector/
│   │   └── playwright
│   │
│   ├── services/
│   │   ├── filtering
│   │   ├── classification
│   │   ├── jobs
│   │   ├── clustering
│   │   └── summarization
│   │
│   ├── llm/
│   │   ├── local
│   │   └── groq
│   │
│   ├── db/
│   │
│   └── eve/
│       ├── instructions
│       ├── tools
│       ├── skills
│       └── workflows
```

Adjust this if Eve's actual current conventions require something different.

## Initial data model

At minimum:

### Post

- id
- externalId
- authorName
- authorHeadline
- content
- url
- contentType
- publishedAt
- collectedAt
- hash
- processingStatus

### PostAnalysis

- postId
- categories
- relevanceScore
- summary
- model
- processedAt

### JobOpening

- postId
- company
- role
- location
- remoteStatus
- experience
- skills

### TopicCluster

- id
- title
- summary

### TopicClusterPost

- clusterId
- postId

## UI

Do not recreate an infinite social feed.

The UI should produce a finite digest such as:

- AI / ML
- Software Engineering
- Career
- Engineering Leadership
- Job Market

Each section should show:

- Short digest
- Number of related posts
- A few important source posts
- Links back to original LinkedIn posts

Job Market should show aggregated information such as:

- Companies hiring
- Roles
- Most requested skills
- Most common seniority levels
- Location/remote patterns

## MVP

Keep the first version intentionally small.

V0 should support:

1. Manual collection command
2. Persistent browser profile
3. SQLite storage
4. Deduplication
5. Rule-based filtering
6. Local classification
7. Job extraction
8. Local summarization
9. Simple digest generation
10. Next.js dashboard

Do not add yet:

- Kafka
- Microservices
- Kubernetes
- RAG
- MCP
- Knowledge graphs
- Multiple agents
- Complex distributed infrastructure

## Engineering expectations

I want this built like a maintainable product, not a hackathon demo.

Please:

- Challenge weak assumptions before coding.
- Keep modules replaceable.
- Define clean interfaces for classifier and LLM providers.
- Keep Laya, Ollama and Groq implementations swappable.
- Prefer structured outputs and schemas.
- Add proper logging and processing states.
- Make workflows resumable/idempotent.
- Write tests for core services.
- Keep secrets/configuration outside source control.

Before implementing anything:

1. Review this architecture critically.
2. Identify unnecessary complexity or missing pieces.
3. Check the latest Eve APIs and project conventions.
4. Propose the final MVP architecture.
5. Produce a concise implementation plan broken into independently executable slices.
6. Do not start coding until that plan is coherent.
