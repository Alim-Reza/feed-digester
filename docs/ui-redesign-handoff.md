# UI redesign handoff (spec-third.md)

Written 2026-09-26, at the end of the session that implemented the spec-second.md insight-briefing
redesign (`docs/decisions.md` §11-12, `docs/plan.md` slice 13). That session's context grew too
large to safely continue into the UI redesign itself, so per the user's explicit instruction this
document hands the task to a fresh session/agent. Read this whole document before touching any
code — it exists specifically so you don't have to re-derive what's below from scratch.

**Do not discard the uncommitted working tree.** `git status --porcelain` at the time of writing
shows ~30 modified files and several new ones (the spec-second.md redesign) — nothing has been
committed yet (there is no git history beyond two initial commits; this project deliberately
hasn't started committing regularly, per `docs/session-handoff.md`). All of that is real, tested,
working code (`pnpm lint && pnpm test && pnpm build` passed at handoff time) — it is not scratch
work to clean up.

## 1. The ask

`docs/spec-third.md` (read it in full) asks for a visual redesign of the digest UI to match a
reference design ("Signal Brief"), built in Lovable. Two reference screenshots are at
`docs/image.png` (the main "Today's Briefing" list page) and `docs/image-1.png` (an insight
detail page, reached by clicking a card's "Review sources" / the card itself). **Read both
images directly with your Read tool before starting** — the descriptions below are a structural
aid, not a substitute for looking at them.

The reference's live URL (`https://id-preview--....lovable.app/`) redirects through a Lovable
auth wall (`lovable.dev/auth-bridge`) and could not be fetched (no authenticated browser tool was
available in the handoff session). If your session has real browser access (e.g. a
`claude-in-chrome` or built-in-browser tool), it's worth trying again — the live app might reveal
the Jobs/Saved tab designs neither screenshot shows. Otherwise, work from the two images.

## 2. Scope — the user's own words, and how to read them

Asked directly how to handle the header's "Jobs"/"Saved" nav tabs (only "Briefing" has a
screenshot), the user said:

> "the existing pages on this repo should be also added but accordance with new design system but
> the two pages i gave screenshot should be as they are as much possible without implementing
> anything new"

Read as two separate rules:

1. **The two screenshotted screens** (the briefing list page, and the insight detail page) must be
   reproduced **as faithfully as possible** to the screenshots — visual fidelity is the goal, per
   spec-third.md's own "it should visibly resemble the supplied design" and its screenshot-compare
   verification loop (§9 below). **"Without implementing anything new" means no new backend
   features, no new data fields, no fabricated content, no new persistence** (e.g. don't build a
   real "save this insight" write path if one doesn't already exist — see §6). Use only data the
   app already computes.
2. **Every other existing page** (`/digests` list, `/operations`, `/operations/runs/[id]`,
   `/posts`) should be **restyled to match the new design system** (colors, typography, spacing,
   the new header/nav chrome) — but these have no screenshot reference, so there's no pixel target
   to hit; just make them visually consistent with the two redesigned pages (same dark theme,
   same card/typography language, same header).

**What this implies for "Jobs" and "Saved" (the two nav tabs with no screenshot and no existing
page behind them):** there is no existing standalone Jobs or Saved page in this repo today — the
Job Market data is a *section inside* `/digests/[id]` (already implemented, see §4), and there is
no "saved insights" feature at all. Per rule 2 ("existing pages... restyled," not "new pages
built"), the recommended reading is: **don't invent new `/jobs` or `/saved` routes.** Restyle the
Job Market section in place, inside the redesigned digest page, using the new design language
(it doesn't need to look like anything in the screenshots — there's no reference for it). For the
header nav itself, prefer showing the app's *real* top-level pages (something like
Briefing / Digests / Operations / Posts) over forcing in "Jobs"/"Saved" labels that don't map to
anything real yet. If you disagree or find the live reference app (see §1) shows a real design for
those tabs, that's new information — use judgment, but don't burn much time on it. This is a
judgment call, not a hard constraint from the user.

**Card/detail-page action buttons** (bookmark/save, eye-off/"not useful"/hide, and the detail
page's "Save" / "Not useful" buttons): render them for visual fidelity, but **do not wire them to
a new persistence path**. The existing `feedback` table (`src/db/repositories/feedback.ts`) is
keyed by `postId`, not by insight/cluster id, and topic clusters can span multiple posts — there
is no clean existing mechanism for "save this insight." Inventing one (a new table/column, a new
repo method, a new Server Action) would be exactly the "implementing anything new" the user asked
you not to do for these two screens. Leave the buttons non-functional (or, if you want them to
feel alive, ephemeral client-side-only `useState` with no persistence) unless the user says
otherwise.

## 3. Current architecture — what's already there

- **Layout/chrome**: `app/layout.tsx` — a simple header (`components/nav-links.tsx` +
  `components/theme-toggle.tsx`) inside `border-b border-border`, content in a centered
  `max-w-5xl` column. The reference design's header (logo chip + app name + pill nav +
  right-aligned status text + icon button) and its edge-to-edge dark layout will replace this, at
  least on the redesigned pages — decide whether the new header becomes global (`layout.tsx`) or
  page-specific; global is almost certainly right so the same chrome appears everywhere per §2's
  rule 2.
- **Theming**: `app/globals.css` — Tailwind v4 CSS-first config, shadcn's `base-nova` style
  (`components.json`), Base UI primitives (not Radix — see `docs/decisions.md` §5 for why).
  `:root` and `.dark` each define oklch CSS custom properties (`--background`, `--foreground`,
  `--card`, `--primary`, `--muted`, `--border`, etc.) consumed via `@theme inline` into Tailwind
  utility classes (`bg-background`, `text-muted-foreground`, ...). **To restyle, change these CSS
  variables (primarily under `.dark`, since the reference is a dark-only design) rather than
  hardcoding colors in components** — every existing component already reads them, so retinting
  the tokens retints the whole app consistently. Dark mode is toggled by a `.dark` class on
  `<html>`, set by a `beforeInteractive` script from `localStorage`/OS preference
  (`app/layout.tsx`'s `THEME_INIT_SCRIPT`) — this toggle should probably stay working; just make
  `.dark`'s palette match the reference (the reference has no visible light variant, so light mode
  has no target to match — leave it alone or nudge its accent color for consistency, your call).
- **Component library**: `components/ui/` has `badge`, `button`, `card`, `checkbox`, `input`,
  `label`, `select`, `separator`, `skeleton`, `table`, `tabs`, `textarea` — all Base UI + `cva`
  variants, already dark-mode aware via the CSS variables above. `lucide-react` is the icon
  library (already a dependency, already used in `theme-toggle.tsx`). Prefer extending/restyling
  these over writing new one-off styled `<div>`s, and add new `components/ui/*` files via the
  existing pattern (cva variants, `cn()` from the `cn` package, Base UI primitive where one fits)
  if you need a primitive that doesn't exist yet (e.g. a stat-tile, a collapsible "Triage
  details" section — Base UI likely has an Accordion/Collapsible primitive to wrap).
- **Routes today**: `/` (redirects to the latest digest, or an empty state — `app/page.tsx`),
  `/digests` (list, `app/digests/page.tsx`), `/digests/[id]` (the digest detail — **this is the
  page that becomes "Today's Briefing," screenshot 1**, `app/digests/[id]/page.tsx`),
  `/operations` + `/operations/runs/[id]` (pipeline controls/logs), `/posts` (browse/label
  collected posts). There is no insight-detail route yet — **you'll need a new one**
  (screenshot 2). A natural fit: `/digests/[id]/insights/[insightId]` (keeps "back to briefing"
  trivial — it's just the parent digest route) or a flatter `/insights/[insightId]` with the
  digest id passed as a query param for the back-link. Insight ids are `topicClusters.id` values,
  already globally unique — either works; picking the nested route is probably slightly more
  idiomatic for this app's existing `/operations/runs/[id]` precedent.
- **AGENTS.md's standing instruction** (in this repo's own `AGENTS.md`, re-injected by `next dev`
  every run): this Next.js version may have breaking changes from training-data assumptions —
  read `node_modules/next/dist/docs/` before writing route code, especially anything involving
  route params (`PageProps<'/digests/[id]'>` is already the pattern used, per the existing pages —
  copy it, don't guess at an older Next.js convention).

## 4. Data layer — already implemented, do not re-derive or re-architect

The entire spec-second.md redesign (ranked insights, why-it-matters, source posts, noise
filtering, clustering, structured jobs) is done and tested. **This task is pure UI — map the
following existing shapes onto the new visual design; don't add fields to them unless you find a
screenshot element with genuinely no existing backing data (and even then, prefer reusing an
existing real field over adding a new one — see the source-list note below).**

`src/web/digestView.ts`:
- `getDigestDetail(repos, config, digestId): DigestDetailView | undefined` — the main data call
  for the briefing page.
- `DigestDetailView = { id, windowStart, windowEnd, briefing: BriefingStats, sections:
  SectionView[], jobMarket: JobMarketView | null }`.
- `BriefingStats = { postsScanned, postsUseful, postsFilteredNoise, duplicatesMerged,
  estimatedReadingMinutes }` — **this is exactly the reference's 5-tile stats row** (Posts
  scanned / Useful / Noise hidden / Duplicates merged / ~Min read). No mapping work needed beyond
  picking icons and labels.
- `SectionView = { category, label, tldr, postCount, topics: TopicView[] }` — one per category,
  topics already sorted by rank ascending within it. The reference's category filter tabs (Top /
  AI-Agents / Engineering / Career / Leadership) are `config.categories` labels (`src/config/
  schema.ts`'s `CategoryConfig[]`) plus a synthetic "Top" (= all categories, un-filtered,
  cross-category ranked view — since ranking is already cross-category per `rankInsights`, "Top"
  is just the unfiltered union across all `sections[].topics` re-sorted by `rank`).
- `TopicView = { id, rank, title, summary, whyItMatters, suggestedAction, noveltyLevel,
  confidence, sources: TopicSourceView[] }` — **this is one insight card.** `rank` → the "01"/"02"
  number. `title`/`summary` → the card's headline/body. `whyItMatters` → the orange-accented "WHY
  THIS MATTERS TO YOU" block. `suggestedAction` → the "Suggested: ..." line (nullable — omit the
  line entirely when null, don't force one, per the existing `docs/decisions.md` §11 rationale).
  `sources.length` → the "N sources" pill. `noveltyLevel`/`confidence` (`'low'|'medium'|'high'`)
  are available if you want a "PRIORITY" badge — the screenshot's PRIORITY badge on card 01 but
  not 02 suggests it's shown for the single highest-ranked insight only (`rank === 1`), not a
  per-insight `noveltyLevel === 'high'` condition, but that's a judgment call — either reading is
  defensible from one example.
- `TopicSourceView = { rank, authorName, url }` — used for the card's "N sources" count and for
  the detail page's source list. **The reference's insight-detail sidebar shows more per source
  than this**: a one-line description (e.g. "A field note from a six-agent repository migration")
  and a quoted "why it's useful" excerpt. **We don't generate that data anywhere.** Per §2's "don't
  fabricate," do not invent new LLM-generated descriptions for this. Reasonable real substitutes,
  if you want the richer look: the post's own `authorHeadline` (already stored on `posts`, already
  real) for the description line, and a truncated excerpt of the post's own `content` (already
  real) for the quote. Both require widening `TopicSourceView`/`getDigestDetail`'s source-building
  code to also pull `authorHeadline`/`content` off the post (a small, local addition to an
  existing view-shaping function — not a new architectural surface). If that feels like scope
  creep, it's equally legitimate to just render author name + link and skip the two sub-lines the
  screenshot has — the user said "as much as possible," not "exactly."
- `listDigests(repos): DigestListItem[]` — for `/digests`.

`src/services/jobs/aggregate.ts`: `JobMarketView = JobMarketStats & { openings: JobOpeningView[]
}` — already includes per-opening `url`, `authorName`, and optional `whyRelevant`/`skillGaps`.
This is what the current `/digests/[id]` page's "Job Market" section already renders (aggregate
count tables + a list of individual openings) — just needs restyling, not new data.

`src/web/context.ts`: `getWebContext()` → `{ repos, config }`, the standard entry point every page
already uses.

**Ground rule, unchanged**: `web` is read-only against pipeline data (CLAUDE.md). Any new
Server Action you do add must go through `repos.runCommands.enqueue` / `repos.settings.set` /
`repos.feedback.add` only (see `docs/decisions.md` §6) — but per §2, this task shouldn't need any
new Server Action at all.

## 5. Screenshot structure (read the images yourselves too — this is a map, not a replacement)

**`docs/image.png` — "Today's Briefing" (maps to a redesigned `/digests/[id]`):**
- Header bar: small orange rounded-square logo mark ("S") + "Signal Brief" wordmark (bold), then
  pill-style nav items (active one has a subtle filled pill background + icon), right-aligned
  "⏱ Local index updated 8m ago" muted text + a settings/sliders icon button.
- Hero block: small orange all-caps eyebrow date ("FRIDAY · SEPTEMBER 25"), large bold heading
  ("Today's Briefing"), a muted one-line subtitle summarizing the count, and — right-aligned on
  the same row — the 5-stat-tile strip (icon + big number + small caption per tile), each tile
  separated by thin vertical dividers rather than being separate cards.
- A full-width horizontal rule, then a filter row: category pill tabs on the left (one active,
  filled orange), a "Comfortable" density control with a sliders icon on the right.
- Section eyebrow ("RANKED BY RELEVANCE," orange, small caps) + heading ("Top signals") + a small
  right-aligned "2 of 11 useful" counter.
- A 3-column-wide card grid (in the screenshot, 2 real cards + a mostly-empty-looking 3rd
  placeholder column — likely just how many fit before requiring scroll, not a fixed 3-up grid;
  don't over-index on there being exactly 3 columns). Each card: top row = rank number (orange,
  bold) + category label (small caps muted) + optional "PRIORITY" badge, right-aligned "N sources"
  muted text. Bold title (large). Muted body paragraph. An orange-left-bordered callout box: small
  caps orange "WHY THIS MATTERS TO YOU" label + a bold-ish sentence. A "Suggested: ..." line below
  it (plain text, "Suggested:" bold). Bottom row: "Review sources ›" link-style text+chevron on
  the left, then three icon buttons on the right (bookmark/save — shown filled/active-orange on
  one card, outline on the other; eye-off/hide; external-link/open).
- Below the grid: a collapsible "Triage details ⌃" row (border-top separated), expanded by
  default in the screenshot, showing one line of muted prose explaining what got hidden/merged and
  why — this is just prose built from the same `briefing` stats plus per-category drop reasons if
  you want to go further (not required — the existing stats are probably enough for a reasonable
  sentence).

**`docs/image-1.png` — insight detail (new route):**
- Same header bar as above.
- "← Back to briefing" muted link, top-left.
- Eyebrow: "AI / AGENTS · SYNTHESIZED INSIGHT" (category in orange, "SYNTHESIZED INSIGHT" in
  muted, separated by a middle dot).
- Very large bold title (bigger than the card version — this is the page's main heading).
- Body paragraph (the `summary`), regular weight, muted-ish but readable.
- The same orange-left-border "WHY THIS MATTERS TO YOU" callout, larger/more padded than the card
  version.
- "SUGGESTED ACTION" small-caps eyebrow + the suggested action as its own paragraph (not inline
  "Suggested: ..." like the card — more prominent here).
- Two buttons: filled orange "🔖 Save" and outline "Not useful".
- Right sidebar (roughly 30% width, separated by a vertical rule from the main column): "SOURCE
  SET" eyebrow + "N related posts" heading, then one block per source: "Source 01" muted label +
  external-link icon, bold author name, a muted one-line description, an orange-quote-mark-icon
  callout with a short excerpt ("why it's useful"), and an "Open LinkedIn post ↗" link. (See §4's
  note: the description + quote text isn't backed by real per-source data today — decide how to
  handle per that note.)

## 6. Explicit non-goals for this task

- No new DB schema, no new migration, no new columns.
- No new repository methods beyond, at most, small additions to `digestView.ts`'s existing
  view-shaping functions (e.g. widening the source-view builder to include `authorHeadline`, if
  you go that route per §4).
- No new Server Actions, no new `feedback` writes, no "save an insight" persistence.
- No changes to `src/pipeline/`, `src/services/`, `src/db/schema.ts`, `src/config/schema.ts`, or
  any worker code. This is `app/`, `components/`, and `src/web/` (view-shaping only) territory.
- Don't touch the already-shipped spec-second.md product logic (ranking, novelty evaluation,
  filtering, job extraction) — it's done, tested, and out of scope here.

## 7. Suggested plan (adapt as you learn more — this is a starting point, not a contract)

1. Read `docs/spec-third.md`, `docs/image.png`, `docs/image-1.png` directly. Skim
   `docs/decisions.md` §11 and `docs/project-memory.md` for the product-logic context you're
   building UI on top of.
2. Retint `app/globals.css`'s `.dark` block to the reference palette. Approximate colors sampled
   from `docs/image.png` (quantized, so treat as a starting point to eyeball-correct against the
   actual screenshot, not gospel): page background ~`#101010`–`#141312` (near-black, very
   slightly warm), card/panel surface ~`#181716`–`#1d1b1a` (one step lighter), a third, lighter
   near-black ~`#303030` for borders/dividers, primary text ~`#e0e0e0` (not pure white), muted
   text ~`#98938f` (warm gray), and the accent/brand color — used for the logo chip, active tab,
   rank numbers, category labels, "why it matters" bar and label, priority text — **`#d86040`**
   (a muted burnt-orange/terracotta, notably *not* a bright pure orange like Tailwind's default
   `orange-500`). Map these onto `--background`, `--card`, `--border`, `--foreground`,
   `--muted-foreground`, and introduce/repurpose an accent token (`--primary` or a new
   `--accent-signal` custom property) for the orange, then use it consistently everywhere the
   screenshots use it rather than hardcoding the hex in each component.
3. Build the new header/nav chrome (logo mark, wordmark, pill nav, right-side status text +
   icon) — likely in `app/layout.tsx` plus a new `components/app-header.tsx`, replacing/absorbing
   `nav-links.tsx`. Decide the nav item set per §2. The "Local index updated Xm ago" text can be
   real: derive it from `repos.runs.latest()`/`listRecentSucceeded()`'s timestamp relative to now
   (real data, already available — don't hardcode "8m ago").
4. Rebuild `app/digests/[id]/page.tsx` to match screenshot 1: hero + stats strip, category filter
   tabs (client component wrapping section filtering — could be simple client-side show/hide
   since all sections are already server-fetched, or real navigation via a `?category=` search
   param if you'd rather keep it a server component), ranked card grid, triage-details
   collapsible. Reuse/extend `components/ui/*` rather than one-off markup where it fits.
5. Add the new insight-detail route and page, matching screenshot 2, sourced from the same
   `getDigestDetail` call (find the matching `TopicView` by id) or a small new `digestView.ts`
   helper if fetching one insight directly is cleaner than fetching the whole digest.
6. Restyle `/digests` (list), `/operations`, `/operations/runs/[id]`, `/posts` to the new theme —
   consistent tokens/components, no specific layout target.
7. `pnpm lint && pnpm test && pnpm build` (ground rule, CLAUDE.md/AGENTS.md) — this is a UI-only
   change so the existing 293 tests should be untouched; if `pnpm build`'s route-type generation
   complains about a new dynamic route, that's expected the first time (see the existing
   `force-dynamic` precedent on every data-reading page — don't let a new route get statically
   prerendered).
8. **Run the app and visually verify**, per both CLAUDE.md's "UI changes" rule and
   spec-third.md's own §"After implementation" steps: start `pnpm dev` (or `next dev` against a
   seeded scratch `DATA_DIR`, matching the pattern used in `docs/plan.md` slices 10-12's manual
   smoke tests), then capture a real screenshot at a comparable viewport size and compare against
   `docs/image.png`/`docs/image-1.png`. **No browser-automation tool may be available to you
   either** — if not, this repo already depends on **Playwright** (for the LinkedIn collector,
   `src/collector/`) which you can drive directly from a throwaway script
   (`npx playwright screenshot http://localhost:3000/digests/<id> out.png --viewport-size=1512,900`
   or a small `.mjs` using `chromium.launch()`) to get a real rendered screenshot without needing
   a dedicated browser tool. Iterate on spacing/color/typography from there. Delete any throwaway
   script when done.
9. Update `docs/plan.md` (a new slice row) and this document's "status" once done, per this
   project's own documentation habits — future sessions read `docs/plan.md` as the authoritative
   changelog.

## 8. Everything else you need is already true of this repo

Two-process architecture, config system, swappable classifier/LLM interfaces, the pipeline stage
list — none of it is relevant to this task and none of it should change. If you find yourself
about to edit anything under `src/pipeline/`, `src/services/` (other than `digestView.ts`'s
consumers in `src/web/`), `src/worker/`, or `src/db/schema.ts`, stop and reconsider — that's very
likely scope creep for a UI redesign task.
