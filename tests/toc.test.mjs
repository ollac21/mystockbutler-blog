import assert from 'node:assert/strict';
import test from 'node:test';
import { addHeadingIds, headingId, newIdRegistry, tocPanelHtml } from '../scripts/lib/toc.mjs';

// Owner order 2026-10-09: the Contents is the report viewer's -- chapters (<h2>) holding their subsections
// (<h3>), every heading with an id, ids given in document order (the landing route's rule).
test('every h2 and h3 gets an id in document order; each h2 is an entry holding the h3s after it', () => {
  const html = '<h3>Before any chapter</h3><h2>Executive summary</h2><p>a</p><h3>What the business is</h3><h3>The verdict</h3><h2>1. The business</h2><h3>1.1 — What it sells</h3><h2>2. The market</h2>';
  const { html: out, entries } = addHeadingIds(html);
  assert.deepEqual(entries, [
    {
      id: 'executive-summary',
      label: 'Executive summary',
      subsections: [
        { id: 'what-the-business-is', label: 'What the business is' },
        { id: 'the-verdict', label: 'The verdict' },
      ],
    },
    { id: '1-the-business', label: '1. The business', subsections: [{ id: '1-1-what-it-sells', label: '1.1 — What it sells' }] },
    { id: '2-the-market', label: '2. The market', subsections: [] },
  ]);
  assert.ok(out.includes('<h2 id="1-the-business">1. The business</h2>'));
  assert.ok(out.includes('<h3 id="the-verdict">The verdict</h3>'));
  assert.ok(out.includes('<h3 id="before-any-chapter">Before any chapter</h3>'), 'an h3 before any h2 gets an id, no entry');
});

test('two headings with the same text get two ids; reserved ids are never taken', () => {
  const used = newIdRegistry();
  const first = addHeadingIds('<h2>Sources</h2><h2>Outlook</h2><h3>Outlook</h3>', used);
  const second = addHeadingIds('<h2>Outlook</h2>', used);
  assert.deepEqual(first.entries.map(e => e.id), ['sources-2', 'outlook']);
  assert.deepEqual(first.entries[1].subsections.map(s => s.id), ['outlook-2']);
  assert.deepEqual(second.entries.map(e => e.id), ['outlook-3']);
});

test('inline tags leave the label, escaped text stays escaped, an existing id is kept', () => {
  const { html, entries } = addHeadingIds('<h2>McDonald&#39;s <em>numbers</em></h2><h2 id="kept">Kept</h2><h3 id="kept-sub">Sub</h3>');
  assert.deepEqual(entries, [
    { id: 'mcdonald-s-numbers', label: 'McDonald&#39;s numbers', subsections: [] },
    { id: 'kept', label: 'Kept', subsections: [{ id: 'kept-sub', label: 'Sub' }] },
  ]);
  assert.ok(html.includes('<h2 id="kept">Kept</h2>'));
  assert.ok(html.includes('<h3 id="kept-sub">Sub</h3>'));
});

test('a heading with no letters still gets an id', () => {
  assert.equal(headingId('—', newIdRegistry()), 'section');
});

test('no Contents under three entries; the Contents links every chapter and subsection once', () => {
  const two = [{ id: 'a', label: 'A', subsections: [] }, { id: 'b', label: 'B', subsections: [] }];
  assert.equal(tocPanelHtml(two), '');
  const three = [{ id: 'a', label: 'A', subsections: [{ id: 'a1', label: 'A one' }] }, ...two.slice(1), { id: 'c', label: 'C', subsections: [] }];
  const html = tocPanelHtml(three);
  for (const id of ['a', 'a1', 'b', 'c']) assert.equal((html.match(new RegExp(`href="#${id}"`, 'g')) || []).length, 1, id);
  assert.match(html, /<nav class="toc" id="post-index" aria-label="Contents">/);
  assert.match(html, /<span class="toc-title">Contents<\/span>/);
  assert.doesNotMatch(html, /In this report/);
});

test('a chapter with subsections folds behind an arrow; only the first starts open (the chapter being read)', () => {
  const entries = [
    { id: 'a', label: 'A', subsections: [{ id: 'a1', label: 'A one' }] },
    { id: 'b', label: 'B', subsections: [{ id: 'b1', label: 'B one' }] },
    { id: 'faq', label: 'Frequently asked questions', subsections: [] },
  ];
  const html = tocPanelHtml(entries);
  assert.equal((html.match(/<details open>/g) || []).length, 1);
  assert.equal((html.match(/<details>/g) || []).length, 1);
  assert.ok(html.indexOf('<details open>') < html.indexOf('href="#a"'));
  assert.equal((html.match(/class="toc-arrow"/g) || []).length, 2);
  // The column's fold button needs the page script: it ships hidden.
  assert.match(html, /<button class="toc-fold" type="button" data-toc-fold hidden aria-label="Collapse report contents"/);
});
