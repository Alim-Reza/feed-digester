export type ExtractedPost = {
  /** Index into this tick's matches; also written to the element as `data-fd-idx` so a
   * screenshot can be taken afterward (screenshots need a live element handle, which can't be
   * returned from `page.evaluate`). */
  idx: number;
  html: string;
  inViewport: boolean;
  hasVisualMedia: boolean;
};

/**
 * Runs in the page. Finds real feed posts the same way slice 3's fixture-capture tool does
 * (`[role="listitem"]` filtered to ones with post text or an author control, deduped to the
 * outermost match — see `scripts/capture-fixtures.ts`), but unlike that read-only tool this
 * one expands "see more" for posts currently in the viewport before reading each element's
 * outerHTML, so the captured text isn't truncated. Allowed per grill C3: clicking "see more"
 * only expands text already on the page and writes nothing to LinkedIn.
 *
 * `hasVisualMedia` is a coarse, unverified-against-real-markup heuristic (a large `<img>` or a
 * `<video>`) used only to decide whether an element screenshot is worth capturing for OCR
 * (slice 5) — it is deliberately looser than `detectContentType` in parsePost.ts, which stays
 * conservative per slice 3's "don't guess" rule. A false positive here just costs an
 * unnecessary screenshot, not a wrong stored content type.
 */
export const EXTRACT_POSTS_SNIPPET = `
  (async function () {
    const isPostLabel = (label) => /^(Hide post by |Open control menu for post by )/i.test(label || '');
    const candidates = Array.from(document.querySelectorAll('[role="listitem"]')).filter((el) => {
      if (el.querySelector('[data-testid="expandable-text-box"]')) return true;
      return Array.from(el.querySelectorAll('[aria-label]')).some((n) => isPostLabel(n.getAttribute('aria-label')));
    });
    const outermost = candidates.filter((el) => !candidates.some((other) => other !== el && other.contains(el)));

    let clicked = false;
    outermost.forEach((el, idx) => {
      el.setAttribute('data-fd-idx', String(idx));
      const rect = el.getBoundingClientRect();
      const inViewport = rect.bottom > 0 && rect.top < window.innerHeight;
      if (inViewport) {
        const seeMore = el.querySelector('[data-testid="expandable-text-button"]');
        if (seeMore) {
          try {
            seeMore.click();
            clicked = true;
          } catch (e) {
            // best-effort only
          }
        }
      }
    });
    // Give React a tick to re-render the expanded text before we read outerHTML.
    if (clicked) await new Promise((resolve) => setTimeout(resolve, 150));

    return outermost.map((el, idx) => {
      const rect = el.getBoundingClientRect();
      const inViewport = rect.bottom > 0 && rect.top < window.innerHeight;
      const hasVisualMedia =
        Array.from(el.querySelectorAll('img')).some((img) => img.naturalWidth > 150 && img.naturalHeight > 150) ||
        !!el.querySelector('video');
      return { idx, html: el.outerHTML, inViewport, hasVisualMedia };
    });
  })()
`;
