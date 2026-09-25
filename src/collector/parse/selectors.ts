/**
 * Every LinkedIn DOM selector lives here (plan §7: "LinkedIn changes its markup" risk —
 * "all selectors in one file").
 *
 * As of 2026-09, LinkedIn's feed renders through a server-driven UI system with fully
 * hashed/atomic CSS classes (e.g. `_1274a681`, `cf8121e6`) — there is no semantic class
 * naming left at all (`feed-shared-*`, `update-components-*` etc. are gone). The stable
 * surface instead is ARIA attributes (required for accessibility, so they change less
 * often than styling) and `data-testid`. Confirmed against a real captured feed page
 * (see `scripts/diagnose-feed.ts`); still best-effort beyond what that one session showed
 * — correct against real fixtures as they're captured.
 */
export const selectors = {
  /**
   * Feed posts render inside `[role="listitem"]`, but so do other things (comments, nav
   * carousels). A real post is one that also has either post text or a "Hide post by" /
   * "Open control menu for post by" control — see `isPostContainer` in parsePost.ts.
   */
  postContainer: '[role="listitem"]',

  /** aria-label reads "Hide post by <Name>" — the most reliable author-name source found. */
  hidePostButtonLabel: /^Hide post by (.+)$/i,
  /** Same name, alternate control that's sometimes present without "Hide post by". */
  postControlMenuLabel: /^Open control menu for post by (.+)$/i,

  postText: '[data-testid="expandable-text-box"]',
  seeMoreButton: '[data-testid="expandable-text-button"]',

  /** No confirmed real example yet — best guess, unverified. Correct once one is captured. */
  sponsoredText: /\bPromoted\b/,
  /** No confirmed real example yet — best guess: a leading "<Name> reposted this" line. */
  repostedTextPattern: /^(.+?)\s+reposted this/i,

  /** Relative post age ("15h", "2d", "1w") — a <p> whose own text starts with this pattern. */
  relativeTimePattern: /^\s*(\d{1,2})\s*(s|m|h|d|w|mo|yr)\b/i,

  /** Social-proof line ("X and Y like this", "X, Y and 4 others like this") that can appear before the actor block. */
  socialProofPattern: /\blikes? this\b/i,

  /**
   * Not present as a container-level attribute in current markup (no `data-urn` on the
   * post anymore). Sometimes recoverable opportunistically from a nested comment's
   * `componentkey="replaceableComment_urn:li:comment:(activity:<id>,...)"` when the post
   * has at least one comment rendered — best-effort only, expect this to be null often.
   */
  nestedCommentActivityId: /urn:li:comment:\(activity:(\d+)/,

  connectionSuggestionText: /people you may know/i,
} as const;
