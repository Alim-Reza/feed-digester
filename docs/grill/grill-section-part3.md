# Grill Section — Part 3

This round is short: one correction, the decisions I made from Part 2, and two questions.

---

## 1. Correction: the Workflow SDK won't resume after a crash here

In Part 2, I said the Workflow SDK "runs locally" and resumes from the last completed step after a crash. When I checked its docs for the plan, that turned out to be only half true:

- The **local world** is documented as _"designed for development, not production"_. Its step queue is **in memory**: _"Steps are queued in memory and do not persist across server restarts."_ ([Local World docs](https://workflow-sdk.dev/worlds/local))
- The durable options are the Postgres world, which needs a running Postgres server, or Vercel's hosted world. Self-hosting outside Vercel also has open, unanswered issues ([vercel/workflow#611](https://github.com/vercel/workflow/issues/611)).

So on your Mac, the Workflow SDK would **not** give us the crash-and-resume behaviour you chose it for, unless we also run Postgres, which would be a second database next to SQLite.

**What I recommend instead:** a small **pipeline runner that stores its progress in SQLite**, which we'd write ourselves (a few hundred lines):

- Every post has a `processingStatus` (the spec already has this field). Each stage processes "posts in state X" in batches and **commits after every batch**.
- Every run has a row that records its current stage. When the worker starts, it resumes any run that was interrupted.
- Retries with backoff happen per batch. If one post fails, only that post is marked `failed`; the rest of the run continues.
- Every stage can safely run again (idempotent), because the progress lives in the data, not in a framework.

This keeps what you wanted from option (a): a deterministic pipeline, no LLM deciding the steps, and framework-free services. It also has no extra infrastructure. When we move to Supabase later, the Workflow SDK's Postgres world becomes realistic, so I've added "revisit Workflow SDK" to `improvement.md`.

**Q17.** Should I use the SQLite-backed runner and record the reasoning in an ADR?

> **A:**ok

---

## 2. My Decisions From Part 2 Answers

Write `OBJECT: <reason>` under any you disagree with.

| ID  | Decision                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | No Eve in V0. The "chat with my digests" Eve agent is in `improvement.md`.                                                                                                                                                                                                                                   |
| Q3  | **No personal profile.** Relevance is a general judgement: "how substantive/useful is this for a software engineer" (a Laya score from 0 to 3), combined with category confidence. The config keeps an optional `profile` text field that's empty by default, so you can add one later without code changes. |
| Q4  | Full run **≤ 40 min**: up to 15 min of scrolling plus a processing target of ≤ 20 min. Anything longer is logged as a warning, and the run isn't killed.                                                                                                                                                     |
| Q7  | A cycle is a **completed run**. Default **N = 7**, configurable. What gets deleted and what gets kept is exactly as listed in Q7(c).                                                                                                                                                                         |
| Q8  | Wait **15 min** for a manual solve, then save what was collected and continue processing it. The UI shows an "awaiting you" banner in the meantime.                                                                                                                                                          |
| Q9  | You answered "yes", which I'm reading as **the whole digest in English**, with Bangla posts summarized in English. (See Q18.)                                                                                                                                                                                |
| Q10 | Daily run at **08:00 local time**. If that time was missed (Mac asleep or worker not running), it **catches up** the next time the worker is up, at most once per day.                                                                                                                                       |
| Q11 | (a) The worker runs its own scheduler and catches up on missed runs, with an optional `launchd` entry so it starts at login.                                                                                                                                                                                 |
| Q12 | ~~Node 24 LTS~~ **Revised (chat, 2026-09-25):** `engines` `>=24` and `.nvmrc` `26`, since Node 26 becomes LTS in Oct 2026. Your Node 25 is still allowed; switch to 26 if a native module (better-sqlite3, onnxruntime-node) fails to install. pnpm via `corepack enable`.                                   |
| Q15 | **MIT** license, plus a README disclaimer about LinkedIn's terms and "use at your own risk".                                                                                                                                                                                                                 |

---

## 3. Remaining Questions

**Q18.** Is my reading of Q9 right: the digest is written entirely in English?

> **A:**yes
