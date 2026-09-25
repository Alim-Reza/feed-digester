# Building a LinkedIn digest tool with an AI agent, end to end

_Draft — edit freely before publishing. Facts below are checked against the actual code as of
2026-09-25; opinions and framing are mine to adjust._

## The problem

I don't want to scroll LinkedIn. I want to know what happened — what people in software
engineering and AI are actually talking about, who's hiring and for what, anything genuinely
worth my ten minutes — without opening the feed and losing forty. So I built a tool that does the
scrolling for me: it logs into a dedicated LinkedIn account through a real, human-paced browser
session, reads what's on screen, filters the noise, classifies and clusters what's left, and
writes me a short daily digest. Job postings get pulled out into their own section: company,
role, skills, seniority, so I can see what the market's actually asking for without reading every
"we're hiring!" post individually.

This post is about the tool, and about building the whole thing — spec through twelve
implementation slices to a working end-to-end pipeline — with Claude Code as the one actually
writing the code.

## Starting from a spec, not a prompt

I didn't describe this project in a single message and let an agent run. I wrote a spec first —
architecture sketch, data model, the six categories I cared about, an MVP scope — and then went
through three rounds of what I've started calling "the grill": Claude Code asking me pointed
questions about everything the spec left ambiguous or assumed. Some questions I answered
directly ("no comments, ever" / "separate account for this, not my main one"). A lot I answered
"your call," which turned out to matter: those became decisions Claude Code had to research and
justify, not just guess at.

Two of those research passes changed the architecture outright. The spec named Vercel Eve for
orchestration; researching it directly turned up that Eve's durability unit is "one LLM call plus
its tool calls" — there's no way to express a fixed pipeline in it without paying for an LLM
decision at every stage transition, and its local-only durability mode holds state in memory,
so a crash loses everything anyway. The spec also named Laya for cheap local classification; its
own authors' benchmark showed 0.36 zero-shot accuracy. Both got written up as ADRs instead of
silently swapped — Eve became a deterministic SQLite-backed pipeline runner I built by hand
(a few hundred lines, in the end), and Laya became one half of a bake-off against a second
classifier, decided later once there was real data to test against.

Then there was a plan doc, reviewed and approved before any code — and a filesystem bug that
destroyed it. macOS's default filesystem is case-insensitive, and I had both a `plan.md` (the
approved architecture) and a `PLAN.md` (the slice-status tracker) in the same repo. They're the
same file on disk. A routine update to the tracker silently overwrote the architecture doc, and
there was no git history yet to recover it from. We noticed at the start of slice 4, wrote a
permanent warning at the top of the tracker, and kept building from what survived scattered
across the other docs. It's still broken, on purpose — fixing it (renaming the tracker) was never
worth interrupting the build for.

## The architecture, briefly

Two processes, one SQLite database, WAL mode so they can both touch it at once: a Next.js web
app that's read-only against pipeline data (its only writes are enqueuing a "please run this"
row and saving config/feedback edits), and a worker that's the sole writer of everything else —
polling for commands, checking a daily schedule, and running the actual pipeline. No queue, no
workflow engine, no separate durability layer: a post has a status, a stage picks up posts in the
status it consumes, and every batch's writes plus status change commit in one transaction. Crash
resume falls directly out of that — there's nothing to specifically build for it.

The pipeline itself is nine fixed stages: collect, OCR, filter, classify, extract jobs, cluster,
summarize, digest, retention. Nothing decides the order at runtime; it's a plain array of stage
objects, and a stage is just a function against a shared context. The pieces that actually needed
to be swappable — which classifier, which LLM provider, which OCR backend, how the browser is
driven — are interfaces with a real implementation and a fake, and every automated test runs
against the fake. No test in the suite opens a real browser, calls real Ollama, or loads a real
model. That was a deliberate line, not laziness: it keeps the test suite fast and deterministic,
at the cost of the real paths only ever getting manually smoke-tested.

## The bake-off, and the answer I didn't expect

The classifier decision was supposed to happen by hand-labeling about 150 posts and running a
precision/recall script against both classifiers. I never did that. Instead, once there was real
collected data, I ran both classifiers over the same 101 posts, dumped their raw output side by
side into a JSON file, and handed it to a separate model to judge directly — no ground truth,
just "here's what each one said about each post, which one's actually right."

The verdict surprised me a little: the bigger model (gemma4, via Ollama) was clearly better at
figuring out _what a post was about_ — genuine semantic disagreements, and gemma4 was right most
of the time. But its own opinion of _how relevant_ a post was turned out to be almost useless:
asked for a 0-to-1 relevance score directly, it called two-thirds of everything highly relevant.
The smaller specialist model (Laya) was much worse at categorization but noticeably better
calibrated on relevance. So the fix wasn't "pick a winner" — it was "take gemma4's category
confidence scores, which are good, and stop asking it for a relevance number at all; compute
relevance myself as a weighted sum of the category scores instead." That's the kind of fix that's
obvious in hindsight and easy to miss if you only ever look at one metric.

## What actually broke, live

Two things, both found after the code was "done" in the sense of every test passing.

First, the digest pages. The very first production build silently turned my home page and digest
list into static HTML, frozen at build time, because nothing told Next.js they read live database
state that changes constantly. `pnpm build` didn't error — it just quietly baked in stale data.
Caught by actually reading the build output's route table, not by any test.

Second, and more interesting: the scheduler retry-stormed. A leftover Chrome profile lock (a
stale file from an earlier session that didn't exit cleanly) made the collector fail in about a
second, every time. Nothing was stopping the scheduler from just trying again on the very next
tick, sixty seconds later. It fired more than ten times in under an hour before I noticed. The
config already had a `maxRunsPerDay` field — explicitly described, back in the design questions,
as an anti-hammering safety measure for exactly this kind of situation — but nobody had ever
actually wired it into the code that checks the schedule. It had been sitting there, declared and
unused, since the very first slice. Finding that felt like the most useful bug of the whole
project: not a crash, not a test failure, just a safety mechanism that existed on paper and did
nothing at runtime until something actually exercised it.

## What I'd tell someone doing this again

Write the spec, then let the agent interrogate it before any code exists. The questions I
answered "your call" produced better decisions than the ones I answered myself, because they came
with research and a documented rationale I could actually push back on.

Don't trust a decision doc to stay a decision doc. Ours got silently destroyed by a filesystem
quirk we hadn't thought to check for, and the fix was "notice it, document it loudly, keep
going" — not "stop and rebuild it perfectly." A slightly damaged but honest record beat a
pristine one we'd have spent a day recovering.

Config fields that exist but aren't wired up are a specific, findable category of bug. Grep for
what's declared versus what's actually read. `maxRunsPerDay` sat unused for the entire build; it
took a real incident to surface it, and it could have been caught by anyone just asking "does
anything reference this."

And test the interfaces, not the implementations that happen to exist behind them right now.
Every real browser call, every real model call in this project is untested by design — which
means the actual moment of truth is always a manual run against real data, no matter how green
the test suite is. That's a fine tradeoff for a project this size. It's worth knowing you made it
on purpose, though, rather than discovering it's true the first time something real breaks.
