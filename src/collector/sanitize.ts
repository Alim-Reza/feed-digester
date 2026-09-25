/**
 * Strips a captured post's outerHTML down to what the parsers actually need, before it's
 * saved as a fixture: no <script>/<style>, no event handlers, no oversized inline image
 * data. Keeps `data-urn` and visible text/structure intact. Pure and testable — no DOM.
 */
export function sanitizePostHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/(src|srcset)="data:[^"]{80,}?"/gi, '$1="data:truncated"')
    .replace(/(src|srcset)='data:[^']{80,}?'/gi, "$1='data:truncated'")
    .trim();
}
