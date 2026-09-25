# LinkedIn parser fixtures

Sanitized post HTML captured with `pnpm collect:fixtures` (see
`scripts/capture-fixtures.ts`), used by the parser tests in
`src/collector/parse/`.

**This directory contains real scraped LinkedIn content** — other people's
post text, author names, and headlines, from whatever appeared in your feed
during capture. `sanitizePostHtml` strips scripts, event handlers, and large
inline image data, but it does **not** anonymize the content itself.

**Do not push this repository to a public remote with these fixtures
included.** If you want to share this project publicly, keep this directory
local-only (e.g. remove it from git tracking) or replace its contents with
hand-written synthetic markup before pushing.
