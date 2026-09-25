export type PageState = 'feed' | 'checkpoint' | 'login_wall' | 'unknown';

/**
 * URL-based classification of where the collector currently is. LinkedIn routes both
 * checkpoints and CAPTCHA challenges through `/checkpoint/...`; a login wall (session expired,
 * or the profile was never signed in) redirects to `/login` or `/uas/login`. Best-effort like
 * the rest of the collector's markup assumptions (plan slice 3) — unverified against a real
 * checkpoint, since deliberately triggering one isn't something we'd do to capture a fixture.
 * `'unknown'` covers anything else (e.g. a page still loading mid-navigation); the caller
 * treats it the same as a block — wait and recheck — rather than assuming it's safe.
 */
export function classifyUrl(url: string): PageState {
  if (/\/checkpoint\//i.test(url)) return 'checkpoint';
  if (/\/(?:uas\/)?login\b/i.test(url)) return 'login_wall';
  if (/\/feed\/?/i.test(url)) return 'feed';
  return 'unknown';
}
