import assert from 'node:assert/strict';
import test from 'node:test';
import { addHeadingIds, headingId, newIdRegistry, tocInlineHtml, tocPanelHtml } from '../scripts/lib/toc.mjs';

test('every h2 gets an id and one entry, in order; h3 is left alone', () => {
  const html = '<h2>Executive summary</h2><p>a</p><h3>What the business is</h3><h2>1. The business</h2><h2>2. The market</h2>';
  const { html: out, entries } = addHeadingIds(html);
  assert.deepEqual(entries, [
    { id: 'executive-summary', label: 'Executive summary' },
    { id: '1-the-business', label: '1. The business' },
    { id: '2-the-market', label: '2. The market' },
  ]);
  assert.ok(out.includes('<h2 id="1-the-business">1. The business</h2>'));
  assert.ok(out.includes('<h3>What the business is</h3>'));
});

test('two headings with the same text get two ids; reserved ids are never taken', () => {
  const used = newIdRegistry();
  const first = addHeadingIds('<h2>Sources</h2><h2>Outlook</h2>', used);
  const second = addHeadingIds('<h2>Outlook</h2>', used);
  assert.deepEqual(first.entries.map(e => e.id), ['sources-2', 'outlook']);
  assert.deepEqual(second.entries.map(e => e.id), ['outlook-2']);
});

test('inline tags leave the label, escaped text stays escaped, an existing id is kept', () => {
  const { html, entries } = addHeadingIds('<h2>McDonald&#39;s <em>numbers</em></h2><h2 id="kept">Kept</h2>');
  assert.deepEqual(entries, [
    { id: 'mcdonald-s-numbers', label: 'McDonald&#39;s numbers' },
    { id: 'kept', label: 'Kept' },
  ]);
  assert.ok(html.includes('<h2 id="kept">Kept</h2>'));
});

test('a heading with no letters still gets an id', () => {
  assert.equal(headingId('—', newIdRegistry()), 'section');
});

test('no index under three sections; the index links every section once', () => {
  const two = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
  assert.equal(tocInlineHtml(two), '');
  assert.equal(tocPanelHtml(two), '');
  const three = [...two, { id: 'c', label: 'C' }];
  for (const html of [tocInlineHtml(three), tocPanelHtml(three)]) {
    assert.equal((html.match(/<li>/g) || []).length, 3);
    assert.ok(html.includes('<a href="#c">C</a>'));
  }
});
