# Grill Section — Part 1

Questions about `spec.md`. Write your answer under each **A:** line. If you don't know or don't care, write `your call` and I'll decide and explain why in Part 2. If an answer raises new questions, they'll go in `grill-section-part2.md`.

Each question has an ID (e.g. `C3`) so we can refer to it later.

---

## A. Intent & Usage

**A1.** Who uses this: only you, on one machine? Or could anyone else ever run it (a friend, open source, a hosted version)?

> **A:**initially only me, but the setup should be like that can be open source and supports self hosted version

**A2.** How often do you want a digest? (daily / every few days / weekly / whenever you run it by hand)

> **A:**daily and when ever i run it by hand, the ui should have a button that triggers it to rerun it.

**A3.** What does "finite" mean to you in practice? E.g. "reading it takes ≤ 10 minutes", "≤ N items per section", or "whatever fits".

> **A:**your call

**A4.** When one digest has been generated, should posts already in it be left out of the next one? Or do you want rolling/cumulative views too (e.g. "this week in AI")?

> **A:**your call

**A5.** Why V0, and what does success look like? What result after 1–2 weeks of use would make you say "this works"?

> **A:**your call

**A6.** Are there any hard deadlines or a time budget for V0?

> **A:**nope

---

## B. Risk & Compliance

**B1.** Automated scraping breaks LinkedIn's User Agreement, even when it's read-only and uses your own session. That can get your account restricted. Do you accept that risk for your **main** account, or should the collector run on a separate account?

> **A:**no ofcourse not , will create a separate account for it, and log in via that but for initial setup will use the main one

**B2.** Should the collector deliberately act like a person (slow scrolling, random pauses, a hard cap on session length and runs per day)? That isn't anti-bot bypassing; it's about not hammering the site. Or should it just scroll plainly at a fixed pace?

> **A:**yes, random pauses slow scrolling, dont give away my intention and presence as a bot.

**B3.** If LinkedIn shows a checkpoint, CAPTCHA, or login wall in the middle of a run, what should the collector do? (abort and notify / pause so you can solve it by hand / save what it has and exit)

> **A:** pause so i can solve it bu hand

**B4.** Collected posts include other people's names and content. Is keeping all of it locally forever fine, or do you want a retention policy, e.g. delete raw text after N days and keep only summaries?

> **A:**delete raw text after N cycles meaning how many times i have run it.

---

## C. Collection

**C1.** Which feed should it read: the default "Top/Relevant" feed or "Most recent"? Should that be configurable?

> **A:**your call

**C2.** Should it only ever collect your home feed? Or do you also want specific sources such as certain people, company pages, hashtags, saved searches, or the LinkedIn Jobs tab?

> **A:**no, just feed, adding special poeple might make linkedin suspicious

**C3.** Many posts are truncated with "…see more". Clicking "see more" only expands text that's already on the page and doesn't write anything to LinkedIn. Is that allowed under your "read-only / only visible information" rule?

> **A:** yes

**C4.** Same question for other things you can open: comments, reshared/quoted posts, attached documents (PDF carousels), and article links. Collect them, skip them, or only record the link?

> **A:**your call but i dont want comments really

**C5.** Images: many posts are mostly an image or infographic. Should the image be ignored, should the alt text be stored, or should the image be saved for OCR or a vision model later?

> **A:**store the images, run batch process to get the text, if the text makes sense then keep the images, if text doesnt make sense then the image is not much worth to me so discard it.

**C6.** Scroll duration: a fixed time (10–20 min), a fixed number of posts, "stop once I reach posts I've already seen", or whichever comes first?

> **A:**your call

**C7.** Should the browser run headed (you can watch it) or headless? Will you be at the machine when it runs?

> **A:**your call

**C8.** Which browser: Chrome that's already installed on the Mac (`channel: 'chrome'`) or Playwright's bundled Chromium? Is it OK for the dedicated profile to live inside the project directory (gitignored), or should it go somewhere else?

> **A:**your call

**C9.** Reposts: if person X reposts person Y's post, who is the "author"? Should we store both? And if the same original post shows up through several reposters, does that count as one post?

> **A:**your call

**C10.** How precise do published times need to be? LinkedIn shows relative times ("3d", "1w"), and an exact timestamp would have to be decoded from the post ID. Is an approximate time fine?

> **A:**your call

**C11.** Should we keep the raw HTML/DOM snapshot of each post so that when LinkedIn changes its markup we can debug and re-parse? That costs disk space.

> **A:**your call

**C12.** Posts in languages other than English: are there any? Keep them, translate them, or drop them?

> **A:**if bangla, then keep, else discard

---

## D. Filtering & Classification

**D1.** Please define "generic personal celebration" with a few examples you'd drop and a few that are close but you'd keep (e.g. "I got promoted to Staff, here's what I learned").

> **A:** "I'm happy to share bla bla bla " these type of post

**D2.** Are there authors, companies, or keywords you'd always keep (allowlist) or always drop (blocklist)? Should you be able to edit those lists from the UI?

> **A:**your call

**D3.** Are the six categories fixed, or should they come from config so you can add more later (e.g. "Startups", "Product")?

> **A:**your call

**D4.** The spec lists 6 interest categories but the UI shows 5 sections, and "Industry/technical news" has no section. Where should news go?

> **A:**your call

**D5.** How should the relevance score work: one global number, or relevance **to you** based on a profile you write (seniority, stack, interests)? If it's personal, please describe that profile.

> **A:**that should be passed to jev/layla

**D6.** Should you be able to give feedback in the UI (👍/👎, "wrong category") that gets stored and used later to tune thresholds or train the classifier? Is that in V0 or later?

> **A:**your call

**D7.** How much do you care about "engagement bait / low-effort AI-generated posts"? Should they be filtered explicitly?

> **A:**dont classify those now i think,

---

## E. Tools I Can't Verify From the Spec (important)

**E1.** **"Vercel Eve"**: please link to it (docs/repo/npm package). I don't want to guess which product you mean. Is it Vercel's Workflow DevKit (`workflow` / "use workflow"), something else, or a product you've seen announced? Is it free/open source, and does it run **fully locally** without deploying to Vercel?

> **A:**https://vercel.com/eve

**E2.** If Eve needs Vercel's cloud (hosted runs, a Vercel account) for durability or scheduling, is that acceptable for a "local-first" tool? Or do we drop to a plain local job runner, and if so which do you prefer: a simple SQLite-backed state machine, or a small library?

> **A:**if it needs vercels cloud, im not sure if it needs or not, check and tell me, but if it needs it, then we will change our strategy

**E3.** Does Eve being an "agent" matter to you? Would an LLM decide which tool to call next, or is it a fixed deterministic pipeline where Eve only provides durability, retries, and scheduling? (I'd recommend the deterministic pipeline, but it's your decision.)

> **A:**your call

**E4.** **"Laya"**: please link to it. Is it a specific model or library? What made you pick it? If it can't be found or doesn't fit, what's acceptable instead?

- (a) Embeddings (e.g. via Ollama) + a lightweight classifier/similarity against category descriptions
- (b) A small zero-shot NLI model run in Node (transformers.js / ONNX)
- (c) A small local LLM with batched structured output
- (d) Something else

> **A:**https://flowtivity.ai/blog/laya-open-source-jev-alternative/
> and for ollama based model: gemma4,
> my thought was , laya will do the classificiation and then batch them together for batch processing via local gemma4 model

**E5.** Is it OK to hand-label a small set of posts (say 100–200) to use as a test set for measuring classifier quality? Would you do the labeling?

> **A:** your call

---

## F. Local Inference & Hardware

**F1.** What Mac is this: chip (M1/M2/M3/M4, Pro/Max) and **how much RAM**? How much disk space is free?

> **A:** m1 pro

**F2.** Is Ollama already installed? Which models, if any, do you already have or prefer?

> **A:** yes, gemma4:latest

**F3.** How long can a full processing run take and still be fine? (5 min / 30 min / "overnight is fine")

> **A:**10-20 min

**F4.** Groq fallback: what exactly triggers it? (Ollama is down / output fails schema validation after N retries / the task is marked "hard" / manual flag) Do you already have a Groq API key? Is sending LinkedIn post text to a cloud API acceptable to you at all?

> **A:**your call

**F5.** Is there a monthly spending cap for cloud inference?

> **A:** check groqs site for how much they are willing to give for free

**F6.** Are other providers acceptable (OpenAI, Anthropic, OpenRouter), or only Groq?

> **A:** any free ones are acceptable, dont have money

---

## G. Jobs

**G1.** Should job extraction cover only posts where someone is hiring ("We're hiring…")? Or also people looking for work, recruiter spam, and job-board reposts?

> **A:**your call

**G2.** Beyond aggregates, do you want job posts matched against **your** profile (e.g. "3 roles fit you")? If yes, what are your target roles, seniority, locations, remote preference, and stack?

> **A:** not just the ones that fits me, all of them, so i can get an idea what market needs now

**G3.** One post often lists several roles. Is that one `JobOpening` row per role (the spec's model implies one row per post)?

> **A:**your call

**G4.** Should skills be normalized ("JS" = "JavaScript", "k8s" = "Kubernetes") so the "most requested skills" numbers are meaningful? Using a fixed taxonomy or free-form?

> **A:**your call

**G5.** Should the same job posted by several people be deduplicated across posts and across days?

> **A:**nope

**G6.** Should the Job Market section cover only the current digest window, or show trends over time?

> **A:**your call

---

## H. Clustering & Summarization

**H1.** What should a "topic" be: a story or event ("OpenAI released X"), or a broader theme ("people debating AI coding tools")? That choice changes the clustering approach.

> **A:**your call

**H2.** Can topics span multiple digests/days (a running story), or are they recomputed every time?

> **A:**your call

**H3.** How should summaries sound: bullet points, short paragraphs, TL;DR plus "why it matters to you"? How long?

> **A:**your call

**H4.** Should summaries name authors ("According to Jane Doe…"), or only link to the source posts?

> **A:**your call

**H5.** How important is traceability? Should every claim in a summary point back to the posts it came from, to protect against hallucination?

> **A:**yes

**H6.** The spec's data model has no `Digest` entity, but there's a `saveDigest()` step. Should digests be stored as versioned records you can browse historically ("Digest from Sep 20")?

> **A:**your call

---

## I. UI

**I1.** Is the dashboard read-only (view digests), or should it also have controls: trigger a collection or processing run, see run status/logs, edit config and filters, give feedback?

> **A:**trigger a collection and process run, see status and logs, edit configs

**I2.** Should it be localhost only with no auth, or does it need to be reachable from your phone or other devices?

> **A:** for now only localhost, reachable by phone should be put into an improvement.md file so that we circle back

**I3.** Do you need to browse or search the raw collected posts, including dropped ones, to check whether the filter is too aggressive?

> **A:** for now yes, might delete this feature in future

**I4.** Should you be notified when a digest is ready (macOS notification, email, Telegram/Slack, none)?

> **A:**nah, the ui will suffice i guess

**I5.** Any UI preferences: component library (shadcn/ui, none), Tailwind, dark mode, anything to avoid?

> **A:**shadcn/ui with dark mode

---

## J. Tech Stack & Tooling

**J1.** Node version (e.g. 22 LTS / 24)? Is there a version manager you use (nvm, fnm, volta, mise)?

> **A:** v25+

**J2.** Package manager: pnpm / npm / yarn / bun?

> **A:**npnm

**J3.** Repo layout: one Next.js app with `src/` shared services (as in the spec), or a monorepo (e.g. pnpm workspaces: `apps/web`, `packages/core`, `packages/collector`)?

> **A:**your call

**J4.** Next.js version: the latest (App Router)? Any constraints?

> **A:**your call

**J5.** SQLite access layer: Drizzle / Prisma / Kysely / raw `better-sqlite3` / Node's built-in `node:sqlite`? Any preference or strong dislike?

> **A:**your call

**J6.** Should the code make moving to Postgres later easy, or is SQLite fine indefinitely?

> **A:**might move to firebase or supabase so that we can view it from our phone in future also

**J7.** Schema validation: Zod (v4) / Valibot / other?

> **A:**your call

**J8.** LLM client layer: raw `fetch` to Ollama/Groq, the official `ollama` package, or the Vercel AI SDK (`ai` + providers) for structured output and swapping providers?

> **A:**dont tie it to vercel completely, keep it nimble

**J9.** Test framework: Vitest / Jest / `node:test`? Should Playwright collector tests run against saved HTML fixtures, never live LinkedIn?

> **A:**your call

**J10.** Lint/format: ESLint + Prettier / Biome / oxlint? Is there a strictness level you want (e.g. `strict` TS, no `any`)?

> **A:**ESLint + Prettier

**J11.** Logging: pino / consola / plain console? Should logs go to files, stdout, the DB (per-run records), or some combination?

> **A:**your call

**J12.** CLI: how do you want to trigger things by hand? (`pnpm collect`, a proper CLI with commander/citty, or only through the UI/Eve)

> **A:**through ui

**J13.** Config: `.env` for secrets plus a typed config file (e.g. `digest.config.ts` / YAML) for categories, thresholds, and durations? Any preference?

> **A:**yes

**J14.** Scheduling, if it isn't Eve: launchd / cron / a node scheduler running inside a long-lived process / manual only for V0?

> **A:**will discuss in second part

**J15.** Does it need to run when the Mac is asleep or the lid is closed? (If yes, we have to talk about where it runs.)

> **A:**nope, might shift the whole code to another machine or vps altogether

---

## K. Process & Documentation

**K1.** Should I initialise git now? Will it have a GitHub remote, public or private?

> **A:**dont bother with git now

**K2.** Commit style: Conventional Commits? Should I commit per slice, or leave committing to you?

> **A:**dont bother now

**K3.** Beyond the grill files, which docs do you want kept: `ARCHITECTURE.md`, ADRs (`docs/adr/0001-*.md`) for decisions like "why not Laya", a `PLAN.md` with slice status, a README, CLAUDE.md?

> **A:**your call

**K4.** Once the grilling is done, do you want the architecture review, final architecture, and slice plan written up as a doc (e.g. `plan.md`) for you to approve before any code is written?

> **A:**yes

**K5.** For each slice, do you want to review it before the next one starts, or should I build several slices in a row?

> **A:**just build it
