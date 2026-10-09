// The Contents of a post, read the way the app's report viewer reads a memo (owner order 2026-10-09: the
// blog looks like the viewer): one entry per <h2> of the rendered article (a chapter), each holding its
// <h3>s (the chapter's subsections). The entries print as the Contents column on a wide screen and as the
// drawer the bottom bar's "Contents" half opens on a narrow one; every chapter folds behind an arrow and the
// one being read opens itself (render.mjs's script; without it the first chapter is open).
// The ids follow the same rule as the landing's route (100a-research-landing src/lib/blogOutline.js), so
// a "#1-the-business" link means the same section on both hosts.
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

// Stamps an id on every <h2> and <h3> of `html` that has none, in document order. Returns the new html
// and one entry per <h2>: { id, label, subsections: [{ id, label }] } -- the <h3>s that follow it. The
// label is the heading's own text (already escaped by the markdown renderer) with its inline tags removed.
// An <h3> before the first <h2> gets its id but no entry.
export function addHeadingIds(html, used = newIdRegistry()) {
  const entries = [];
  const out = String(html || '').replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g, (whole, level, attrs, inner) => {
    const label = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!label) return whole;
    const existing = /\sid="([^"]+)"/.exec(attrs || '');
    let id;
    if (existing) {
      id = existing[1];
      used.add(id);
    } else {
      id = headingId(label, used);
    }
    if (level === '2') entries.push({ id, label, subsections: [] });
    else if (entries.length) entries[entries.length - 1].subsections.push({ id, label });
    return existing ? whole : `<h${level}${attrs || ''} id="${id}">${inner}</h${level}>`;
  });
  return { html: out, entries };
}

// An index is shown only when it helps: three entries or more.
export const TOC_MIN_ENTRIES = 3;

const ARROW =
  '<svg class="toc-arrow" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

// One Contents row: a chapter with subsections is a <details> (the arrow folds it; the first one starts
// open, as the chapter being read); any other row is a plain link.
function entryHtml(entry, index) {
  const subsections = entry.subsections || [];
  if (!subsections.length) {
    return `<li class="toc-ch" data-toc-id="${entry.id}"><span class="toc-row"><span class="toc-gap" aria-hidden="true"></span><a href="#${entry.id}">${entry.label}</a></span></li>`;
  }
  const subs = subsections.map(sub => `<li><a href="#${sub.id}">${sub.label}</a></li>`).join('');
  return `<li class="toc-ch" data-toc-id="${entry.id}"><details${index === 0 ? ' open' : ''}><summary class="toc-row">${ARROW}<a href="#${entry.id}">${entry.label}</a></summary><ol class="toc-sub">${subs}</ol></details></li>`;
}

const FOLD_ICON =
  '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/></svg>';

// The Contents column (wide screen) / drawer (narrow screen), with the drawer's backdrop right after it.
// The column's fold button needs the page script, so it ships hidden and the script shows it.
export function tocPanelHtml(entries) {
  if (entries.length < TOC_MIN_ENTRIES) return '';
  return `<nav class="toc" id="post-index" aria-label="Contents">
<div class="toc-head"><span class="toc-title">Contents</span><button class="toc-fold" type="button" data-toc-fold hidden aria-label="Collapse report contents" title="Collapse contents">${FOLD_ICON}</button><a class="toc-close" href="#_" data-toc="close" aria-label="Close report contents">&times;</a></div>
<ol class="toc-list">${entries.map(entryHtml).join('')}</ol>
</nav>
<a class="toc-backdrop" href="#_" data-toc="close" tabindex="-1" aria-hidden="true"></a>`;
}
