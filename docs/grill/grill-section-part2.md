# Grill Section — Part 2

This part has three sections:

1. **Research findings**: what Eve, Laya, Groq and your machine actually look like, checked on 2026-09-25.
2. **Decisions I made on your "your call" items**: skim these and write `OBJECT: …` next to any you disagree with.
3. **New questions**: answer these under each **A:** as before.

---

## 1. Research Findings

### 1.1 Your machine (checked directly)

| Item         | Value                                                                                                                                 | Implication                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chip / RAM   | Apple M1 Pro, **16 GB**                                                                                                               | gemma4 (~10 GB loaded) + Laya (~2 GB) + Chrome + Next.js is tight. The pipeline must run **one stage at a time**, not in parallel, and unload models between stages. |
| Disk         | 286 GB free                                                                                                                           | No concern.                                                                                                                                                          |
| Ollama model | `gemma4:latest` = the **E4B** variant, 8B params, Q4_K_M, 9.6 GB, 128k context, capabilities: completion, **vision**, tools, thinking | Vision means gemma4 _could_ read images, but that is expensive per image. The bigger 12B/26B variants won't fit comfortably in 16 GB.                                |
| Node         | v25.2.1                                                                                                                               | Node 25 is an odd-numbered release and reached **end of life in June 2026**. See Q12.                                                                                |
| pnpm         | **not installed**                                                                                                                     | See Q12.                                                                                                                                                             |
| Chrome       | installed (`/Applications/Google Chrome.app`)                                                                                         | We can use the real Chrome for collection.                                                                                                                           |
| Python       | system 3.9.6 only                                                                                                                     | Too old for most current ML packages. This matters only if we run Laya's Python version (see 1.3).                                                                   |

### 1.2 Vercel Eve: runs locally, but it's a different kind of tool than the spec assumes

- Eve is open source ([github.com/vercel/eve](https://github.com/vercel/eve), docs at [eve.dev](https://eve.dev)). It **does not need Vercel's cloud**:
  - Running locally keeps workflow state on disk in `.eve/.workflow-data`, via the open-source **Workflow SDK**. A Postgres backend can be swapped in.
  - Self-hosting works: `eve build && eve start` produces a Node server, and schedules under `agent/schedules/*.ts` fire on their cron timing.
  - Models can be any AI SDK `LanguageModel`, so Ollama can work through an AI SDK provider.
- **The catch:** Eve is a _conversational agent_ framework. Its durability unit is a "step" = **one LLM call plus the tool calls it makes**. There is no way to write a fixed code pipeline in Eve. The **LLM decides** which tool to call next, and a schedule works by _sending the agent a prompt_.
- That means "Eve orchestrates `collectFeed → classifyPosts → …`" really means "an LLM reads instructions and calls those tools in order, every run". This has three consequences:
  1. There's an extra LLM in the loop every run. Locally that's gemma4 E4B, which is decent at tool calling but not bulletproof on long multi-step chains. The alternative is Groq free tier, which would send your run into the cloud.
  2. It goes against your "minimize unnecessary inference" goal.
  3. It makes the order of pipeline steps non-deterministic, which is the opposite of "resumable/idempotent".
- **The durable-execution engine underneath Eve (the Workflow SDK) can be used on its own.** It gives durable steps, retries and resume from the last completed step in plain TypeScript, with no LLM involved, and it runs locally. That covers what the spec wanted from Eve, minus the agent part.

### 1.3 Laya: real, very new, and zero-shot accuracy is a real risk

- Laya ([NandhaKishorM/laya](https://github.com/NandhaKishorM/laya), weights at [convaiinnovations/laya](https://huggingface.co/convaiinnovations/laya), Apache 2.0) is a ~421M-param ModernBERT "decision engine". It answers typed questions about text (`choice`, `score`, `yes/no`) in one forward pass, with no text generation. There's an English checkpoint and a **multilingual** one covering 100+ languages, which should include Bangla.
- There's a **Node/TypeScript port**, [`@receptron/laya`](https://github.com/receptron/laya) (MIT, community-maintained, ~400 stars). It runs on ONNX Runtime, the weights are ~1.7 GB, it uses ~2 GB RAM, takes ~140 ms per 3-question query on Apple Silicon, and needs no Python.
- **Risk:** the authors' own numbers put **zero-shot accuracy at 0.362, versus 0.766 after fine-tuning** on their benchmark. Our categories would be zero-shot unless we fine-tune, and fine-tuning is Python-only. It was also released only about a week ago.
- Our multi-label classification maps onto it naturally: one `yes/no` per category plus a `score` for relevance to your profile.

### 1.4 Groq free tier

- Free-tier text models include `openai/gpt-oss-120b`, `openai/gpt-oss-20b` and `qwen/qwen3.8-27b`. Typical limits per model are **30 requests/min, 1,000 requests/day, 8K tokens/min, 200K tokens/day**. That's plenty for a fallback, but not enough to run the whole pipeline on.
- I couldn't confirm from the docs whether signup needs a credit card.

---

## 2. Decisions I Made on "Your Call" Items

Write `OBJECT: <reason>` under any you disagree with.

| ID       | Decision                                                                                                                                                                                                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A3       | "Finite" = about a **10-minute read**: at most 5 topics per section and 3 source posts per topic. The Job Market section shows aggregates plus a collapsed table of all roles.                                                                                                                                                                |
| A4       | Each digest covers only posts collected **since the previous digest**. Weekly roll-ups go in `improvement.md`.                                                                                                                                                                                                                                |
| A5       | Success after 2 weeks: (1) you stop opening the LinkedIn feed directly, (2) at least 80% of the posts in the digest are ones you agree belong there (measured with 👍/👎), (3) a full run fits the time budget, (4) no account warnings.                                                                                                      |
| C1       | The default feed as LinkedIn shows it. The sort toggle is unreliable, so it's configurable but not relied on.                                                                                                                                                                                                                                 |
| C4       | No comments. Reshares: store the original post as part of the item. Documents/carousels and article links: store only the URL and title.                                                                                                                                                                                                      |
| C6       | Stop at **whichever comes first**: max duration (default 15 min), max posts (default 300), or 15 posts in a row that were already seen.                                                                                                                                                                                                       |
| C7       | **Headed**, which B3 needs so you can solve a CAPTCHA by hand.                                                                                                                                                                                                                                                                                |
| C8       | The installed Chrome (`channel: 'chrome'`). The profile lives **outside the repo**, in `~/.feed-digester/chrome-profile` (configurable), so it can never end up in an open-source commit.                                                                                                                                                     |
| C9       | Store both the reposter ("via") and the original author. Deduplicate on the **original** post's ID.                                                                                                                                                                                                                                           |
| C10      | Decode the exact time from the post ID when one exists; otherwise approximate from "3d"-style text. Each record stores a precision flag.                                                                                                                                                                                                      |
| C11      | Save a raw HTML snapshot only when parsing a post fails, plus a small sample per run for debugging. Retention (B4) purges these too.                                                                                                                                                                                                          |
| D2       | Allowlist and blocklist (authors, keywords) live in config and can be edited in the UI.                                                                                                                                                                                                                                                       |
| D3       | Categories come from config, each with a description that is passed to Laya as its criteria.                                                                                                                                                                                                                                                  |
| D4       | "Industry & Tech News" gets its own section, making **6 sections**.                                                                                                                                                                                                                                                                           |
| D6       | V0 stores 👍/👎 and "wrong category" feedback. Nothing is trained on it yet; it becomes the labeled set for E5.                                                                                                                                                                                                                               |
| D7       | No engagement-bait filter in V0.                                                                                                                                                                                                                                                                                                              |
| E3       | A **deterministic pipeline**, not an LLM deciding the next step. Q1 covers how that affects Eve.                                                                                                                                                                                                                                              |
| E5       | Yes. The raw-posts browser (I3) gets label buttons, and you label about 150 posts. That's how we find out whether Laya is good enough.                                                                                                                                                                                                        |
| F4       | Groq fallback applies only to generation/extraction steps, and triggers when Ollama is unreachable or output fails schema validation twice. It can be switched off in config. Raw bulk classification is never sent to it.                                                                                                                    |
| G1       | Only "someone is hiring" posts, including recruiter or job-board posts that name a role and company. Posts from people looking for work are not jobs; they go through normal classification.                                                                                                                                                  |
| G3       | **One row per role.**                                                                                                                                                                                                                                                                                                                         |
| G4       | Skills normalized through an alias dictionary in config (`k8s` → `Kubernetes`). Unknown skills are kept as written.                                                                                                                                                                                                                           |
| G6       | Current digest window only in V0. Trends go in `improvement.md`.                                                                                                                                                                                                                                                                              |
| H1       | Topics are **themes within a category**; events show up naturally as tight clusters. Method: local embeddings plus clustering per category, which needs a small Ollama embedding model (~300 MB).                                                                                                                                             |
| H2       | Recomputed for each digest in V0.                                                                                                                                                                                                                                                                                                             |
| H3       | Each section starts with a 2–3 sentence TL;DR. Each topic gets a headline and 2–4 bullets, and **every bullet cites its source posts** `[1][2]`, as you asked in H5.                                                                                                                                                                          |
| H4       | Author names appear in the source list, not in the summary text.                                                                                                                                                                                                                                                                              |
| H6       | Yes: a `Digest` entity, stored and browsable by date.                                                                                                                                                                                                                                                                                         |
| I1 + J13 | Defaults live in a typed config file and secrets in `.env`. Edits made in the UI are stored in the DB and override the file.                                                                                                                                                                                                                  |
| J2       | pnpm.                                                                                                                                                                                                                                                                                                                                         |
| J3       | **A single package, not a monorepo**: the Next.js app, `src/` services, and a separate **worker process** for Playwright and inference. Long-running browser and inference jobs must not run inside Next.js request handlers.                                                                                                                 |
| J4       | Latest stable Next.js, App Router.                                                                                                                                                                                                                                                                                                            |
| J5       | **Drizzle ORM** on SQLite (`better-sqlite3`). This keeps the path to Postgres/Supabase open (Q13).                                                                                                                                                                                                                                            |
| J7       | Zod v4.                                                                                                                                                                                                                                                                                                                                       |
| J9       | Vitest. Collector tests use **saved HTML fixtures only**, plus one manual live smoke-test command.                                                                                                                                                                                                                                            |
| J11      | pino. Logs go to stdout and a rotating file, and per-run records and events go to the DB so the UI can show status and logs.                                                                                                                                                                                                                  |
| K3       | `README.md`, `ARCHITECTURE.md`, `PLAN.md` (slice status), `docs/adr/` for decisions like Eve and Laya, `improvement.md`, and `CLAUDE.md`.                                                                                                                                                                                                     |
| C5       | Images: OCR locally with **tesseract.js** (runs anywhere including a future VPS, supports English and Bangla, no extra install). If the OCR text passes a simple "is this real text" check, it's added to the post and the image is kept; otherwise the image is deleted. gemma4 vision is **not** used per image because it's too expensive. |
| —        | Created `improvement.md` with phone access (I2), weekly roll-ups, job trends, and the VPS move.                                                                                                                                                                                                                                               |

---

## 3. New Questions

**Q1. The Eve decision (most important).** Given 1.2, which option?

- **(a) Workflow SDK directly, no Eve (my recommendation).** A deterministic durable pipeline in plain TypeScript (`collect → dedupe → filter → classify → extract jobs → cluster → summarize → digest`). Each stage is a durable, retryable step that resumes after a crash, with **no LLM orchestrating**. The services stay framework-free, so adding Eve later is cheap.
- **(b) Eve as specified.** One Eve agent with tools, a daily schedule, and an LLM (gemma4 locally or Groq) calling the tools in order each run. Durability comes for free, but you get an LLM in the control loop and a less predictable order of steps.
- **(c) Hybrid: (a) now, Eve later** as a _"chat with my digests"_ agent ("what did people say about agents this week?"). That's where an LLM agent actually adds something. It goes into `improvement.md`.

> **A:**use (a) and send eve to improvement.md

**Q2. Laya plan.** Is this OK?

- Use the Node port `@receptron/laya`, so no Python.
- Hide it behind a `Classifier` interface.
- Build a **gemma4 batched classifier** as the second implementation (many posts per prompt, structured JSON output).
- After you label ~150 posts, compare the two and keep the better one, or combine them (Laya for cheap filtering, gemma4 only for uncertain posts).

If Laya is clearly worse, are you fine dropping it?

> **A:**yes

**Q3. Your relevance profile (D5).** You said it should be passed to Laya. Yes, it'll be passed as the criteria for the relevance `score` question, but **I need the content**. Please fill in or edit:

```
Current role / seniority:
Main stack:
Topics I want MORE of:
Topics I want LESS of:
Career goal for the next 1–2 years:
Locations / remote preference (for context, not for filtering jobs):
```

> **A:**dont bother with it

**Q4. Time budget (F3).** Is 10–20 min for **processing only**, on top of the 10–20 min of scrolling? In other words, is a full run of about 25–40 min OK?

> **A:**your call

**Q5. Where the anti-bot line is (B2).** Here's what I **will** do: slow randomized scrolling, random pauses and dwell times, a realistic viewport, the real installed Chrome with your real profile, and caps on session length and runs per day.

Here's what I **won't** do, because the spec forbids "anti-bot bypass behavior": stealth plugins, spoofed browser fingerprints, faked user agents, or automated CAPTCHA solving.

Do you agree with this line?

> **A:**yes

**Q6. Separate account (B1).** Two things to know before you commit to this:

1. LinkedIn's terms also forbid fake or duplicate accounts, so the separate account carries its own ToS risk.
2. A new account's feed starts **empty**. It will only be useful after you follow the people and companies you care about, and you'd have to do that curation by hand.

Still the plan? And should config support switching profiles, e.g. `main` for setup and testing, `collector` afterwards?

> **A:**yes yes

**Q7. Retention (B4).** "Delete raw text after N cycles". Please confirm:

- (a) What counts as a cycle: a **completed run**, i.e. collection plus digest?
- (b) Default N (5? 7? 30?).
- (c) What gets deleted: post text, OCR text, images, and HTML snapshots. What gets **kept**: URL, author, categories, scores, job rows, and the digest summaries, so the citations in old digests still link to LinkedIn.

> **A:**(a)

**Q8. Waiting for a manual solve (B3).** If a checkpoint appears during a _scheduled_ run and you're away, how long should it wait before saving what it has and exiting? (default: 15 min)

> **A:**your call

**Q9. Bangla (C12).** Should the digest be written **entirely in English**, with Bangla posts summarized in English, or should Bangla content stay in Bangla?

> **A:**yes

**Q10. Daily schedule (A2, J14).** What time should the daily run happen? If the Mac is asleep at that time, should it **catch up** when it wakes up / when the worker starts, or skip that day?

> **A:**your call

**Q11. Scheduler.** How should the schedule be implemented?

- (a) The worker process runs its own scheduler and catches up on missed runs. It starts with `pnpm start`, plus an optional `launchd` entry so it starts automatically when you log in. (recommended)
- (b) `launchd` alone triggers each run.
- (c) Eve schedules, only if you pick (b) in Q1.

> **A:**your call

**Q12. Node & pnpm.** Node 25 is end-of-life. Should I standardize on **Node 24 LTS** (recommended for an open-source project) or Node 26 (current)? I'll pin it with `.nvmrc` and `engines`. And how do you want pnpm installed: via `corepack enable`, or you install it yourself?

> **A:**your call

**Q13. Future remote DB (J6).** **Supabase** is Postgres, so Drizzle can move there with a dialect change. **Firebase** is a NoSQL document database and would need a rewritten data layer. Can I design toward **Supabase/Postgres** and treat Firebase as out of scope?

> **A:**ok

**Q14. LLM client (J8).** The Vercel **AI SDK** (`ai` npm package) is open source and runs anywhere. It **doesn't need Vercel hosting**, and it has providers for Ollama, Groq and OpenAI-compatible APIs, plus structured output built on Zod. My plan is to put it **behind our own `LLMProvider` interface** so it can be swapped out. Is that acceptable, or do you want hand-written `fetch` clients with no AI SDK at all?

> **A:**ok

**Q15. Open source (A1).** Which license: MIT or Apache-2.0? Should the README include a clear disclaimer about LinkedIn's terms and "use at your own risk"?

> **A:**your call

**Q16. VPS move (J15).** A headed browser with manual CAPTCHA solving on a VPS needs a virtual display plus remote access (e.g. noVNC). LinkedIn also treats datacenter IPs as more suspicious. For V0 I'll only keep paths and config portable and put the rest in `improvement.md`. Is that enough, or do you want Docker support in V0?

> **A:**ok
