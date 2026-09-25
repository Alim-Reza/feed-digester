/**
 * A `page.evaluate`/`frame.evaluate`-able expression string that serializes `document.body`
 * with shadow DOM inlined (`outerHTML` alone omits shadow trees). Used for debug snapshots
 * when the normal selectors find nothing — see `scripts/diagnose-feed.ts` and the fallback
 * dump in `scripts/capture-fixtures.ts`.
 */
export const COMPOSED_SERIALIZE_SNIPPET = `
  (function serializeComposed(node, depth) {
    if (depth > 40) return '';
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').trim();
      return t ? t + ' ' : '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'svg') return '';
    const attrs = Array.from(node.attributes || [])
      .map((a) => a.name + '="' + String(a.value).slice(0, 200) + '"')
      .join(' ');
    let inner = '';
    if (node.shadowRoot) {
      inner += '<!--SHADOW-ROOT-->';
      inner += Array.from(node.shadowRoot.childNodes)
        .map((c) => serializeComposed(c, depth + 1))
        .join('');
      inner += '<!--/SHADOW-ROOT-->';
    }
    inner += Array.from(node.childNodes)
      .map((c) => serializeComposed(c, depth + 1))
      .join('');
    return '<' + tag + ' ' + attrs + '>' + inner + '</' + tag + '>';
  })(document.body, 0)
`;
