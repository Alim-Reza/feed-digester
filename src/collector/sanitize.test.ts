import { describe, expect, it } from 'vitest';
import { sanitizePostHtml } from './sanitize';

describe('sanitizePostHtml', () => {
  it('removes script and style tags', () => {
    const html = '<div>hi<script>evil()</script><style>.x{color:red}</style></div>';
    expect(sanitizePostHtml(html)).toBe('<div>hi</div>');
  });

  it('removes inline event handlers', () => {
    const html = `<button onclick="doThing()" onmouseover='doOther()'>Click</button>`;
    const out = sanitizePostHtml(html);
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('onmouseover');
    expect(out).toContain('<button');
  });

  it('truncates large inline image data URIs but keeps short src values', () => {
    const bigData = 'data:image/png;base64,' + 'A'.repeat(200);
    const html = `<img src="${bigData}"><img src="https://example.com/a.png">`;
    const out = sanitizePostHtml(html);
    expect(out).toContain('src="data:truncated"');
    expect(out).toContain('src="https://example.com/a.png"');
  });

  it('keeps data-urn and visible text intact', () => {
    const html =
      '<div data-urn="urn:li:activity:123" class="feed-shared-update-v2">Some post text</div>';
    expect(sanitizePostHtml(html)).toBe(html);
  });
});
