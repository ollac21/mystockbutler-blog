// The index of a post ("In this report"): one entry per <h2> of the rendered article. The same
// entries print three ways (render.mjs): one closed line under the title, a rail in the left margin
// on a wide screen, and a drawer opened by the "Contents" pill on a narrow one.
// Plain JS with no imports: the node tests import this file directly.

const RESERVED_IDS = ['research-hub', 'post-index', 'faq', 'sources', '_'];

export function newIdRegistry() {
  return new Set(RESERVED_IDS);
}

// Heading text -> an id safe in a URL, unique within `used`.
export function headingId(text, used) {
  const base =
    String(text || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&[a-z0-9#]+;/g, ' ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section';
  let id = base;
  for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
  used.add(id);
  return id;
}

// Stamps an id on every <h2> of `html` that has none. Returns the new html and one entry per <h2>:
// { id, label }; the label is the heading's own text (already escaped by the markdown renderer)
// with its inline tags removed.
export function addHeadingIds(html, used = newIdRegistry()) {
  const entries = [];
  const out = String(html || '').replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (whole, attrs, inner) => {
    const label = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!label) return whole;
    const existing = /\sid="([^"]+)"/.exec(attrs || '');
    if (existing) {
      used.add(existing[1]);
      entries.push({ id: existing[1], label });
      return whole;
    }
    const id = headingId(label, used);
    entries.push({ id, label });
    return `<h2${attrs || ''} id="${id}">${inner}</h2>`;
  });
  return { html: out, entries };
}

// An index is shown only when it helps: three sections or more.
export const TOC_MIN_ENTRIES = 3;

function items(entries) {
  return entries.map(entry => `<li><a href="#${entry.id}">${entry.label}</a></li>`).join('');
}

// The one closed line under the title (also the copy a crawler reads).
export function tocInlineHtml(entries) {
  if (entries.length < TOC_MIN_ENTRIES) return '';
  return `<details class="toc-inline"><summary>In this report</summary><ol>${items(entries)}</ol></details>`;
}

// The rail (wide screen) / the drawer (narrow screen), with the drawer's backdrop right after it.
export function tocPanelHtml(entries) {
  if (entries.length < TOC_MIN_ENTRIES) return '';
  return `<nav class="toc" id="post-index" aria-label="In this report">
<div class="toc-head"><span>In this report</span><a class="toc-close" href="#_" data-toc="close" aria-label="Close the index">&times;</a></div>
<ol class="toc-list">${items(entries)}</ol>
</nav>
<a class="toc-backdrop" href="#_" data-toc="close" tabindex="-1" aria-hidden="true"></a>`;
}
