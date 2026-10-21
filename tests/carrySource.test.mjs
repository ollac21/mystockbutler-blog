// B110 ad source: the sign-up buttons carry the visitor's source (scripts/lib/carrySource.mjs).
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { buildStockSite } from '../scripts/lib/stocks.mjs';
import { readFileSync } from 'node:fs';
import { carrySource, carrySourceScript, pickTags } from '../scripts/lib/carrySource.mjs';

const META = 'https://app.mystockbutler.com/signup?ticker=META&src=seo-stock';
const FR = 'https://app.mystockbutler.com/signup?ticker=TD.TO&src=seo-stock&lang=fr';

test('an ad address puts its tags on the button: src replaced, utm and click id added, ticker kept', () => {
  assert.equal(
    carrySource(META, '?src=meta-promise&utm_source=meta&fbclid=abc', ''),
    'https://app.mystockbutler.com/signup?ticker=META&src=meta-promise&utm_source=meta&fbclid=abc',
  );
  const all = carrySource(META, '?utm_source=meta&utm_medium=paid&utm_campaign=promise&utm_content=v2&utm_term=cash+flow&fbclid=F&gclid=G', '');
  assert.equal(all, `${META}&utm_source=meta&utm_medium=paid&utm_campaign=promise&utm_content=v2&utm_term=cash%20flow&fbclid=F&gclid=G`);
});

test('a src that does not have the app\'s shape keeps the link\'s own; the other tags still go through', () => {
  const bad = ['Meta Promise!', 'x'.repeat(40), 'Meta-Promise', '-meta', ''];
  for (const src of bad) {
    assert.equal(carrySource(META, `?src=${encodeURIComponent(src)}`, ''), META, `src=${src}`);
    assert.equal(carrySource(META, `?src=${encodeURIComponent(src)}&utm_source=meta`, ''), `${META}&utm_source=meta`);
  }
  assert.equal(pickTags('?src=' + 'a'.repeat(30)), `src=${'a'.repeat(30)}`);     // 30 characters is the longest the app accepts
  assert.equal(pickTags('?src=' + 'a'.repeat(31)), '');
});

test('no tags in the address leaves the link exactly as it is', () => {
  assert.equal(carrySource(META, '', ''), META);
  assert.equal(carrySource(META, '?ref=newsletter&page=2', ''), META);
  assert.equal(carrySource(META, '?ticker=TSLA&lang=en', ''), META, 'ticker and lang are never taken from the address');
  assert.equal(carrySource(META, undefined, undefined), META);
});

test('a French link keeps lang=fr and its place in the query', () => {
  assert.equal(carrySource(FR, '?src=meta-promesse&utm_source=meta', ''), 'https://app.mystockbutler.com/signup?ticker=TD.TO&src=meta-promesse&lang=fr&utm_source=meta');
});

test('a link without ticker or src gets the tags without any invented ticker', () => {
  assert.equal(carrySource('https://app.mystockbutler.com/signup?src=seo-hub', '?src=meta-promise', ''), 'https://app.mystockbutler.com/signup?src=meta-promise');
  assert.equal(carrySource('https://app.mystockbutler.com/signup?src=blog', '?utm_source=meta', ''), 'https://app.mystockbutler.com/signup?src=blog&utm_source=meta');
  assert.equal(carrySource('https://app.mystockbutler.com/signup', '?utm_source=meta', ''), 'https://app.mystockbutler.com/signup?utm_source=meta');
  assert.equal(carrySource(`${META}#top`, '?utm_source=meta', ''), `${META}&utm_source=meta#top`);
});

test('the first-touch value is used when the address has none; an address with tags wins', () => {
  const stored = pickTags('?src=meta-promise&utm_source=meta&fbclid=abc');
  assert.equal(stored, 'src=meta-promise&utm_source=meta&fbclid=abc');
  assert.equal(carrySource(META, '', stored), 'https://app.mystockbutler.com/signup?ticker=META&src=meta-promise&utm_source=meta&fbclid=abc');
  assert.equal(carrySource(META, '?ref=x', stored), carrySource(META, '', stored));
  assert.equal(carrySource(META, '?utm_source=reddit', stored), `${META}&utm_source=reddit`);
  assert.equal(carrySource(META, '', 'src=Not%20Valid!&junk=1'), META, 'a stored value is checked like an address');
});

test('values are URI-encoded and cut at 200 characters; a broken character cannot throw', () => {
  assert.equal(carrySource(META, '?utm_campaign=a%26b%3Dc%20d', ''), `${META}&utm_campaign=a%26b%3Dc%20d`);
  const long = carrySource(META, `?utm_content=${'z'.repeat(500)}&gclid=${'9'.repeat(201)}`, '');
  assert.equal(long, `${META}&utm_content=${'z'.repeat(200)}&gclid=${'9'.repeat(200)}`);
  const pair = '😀';                                                              // two code units: the cut at 200 must not split it
  assert.equal(pickTags(`?utm_term=${'a'.repeat(199)}${encodeURIComponent(pair)}`), `utm_term=${'a'.repeat(199)}`);
  for (const odd of ['?utm_source=%ED%A0%80&fbclid=ok', `?utm_source=${String.fromCharCode(0xd800)}&fbclid=ok`, '?utm_source=%&fbclid=ok']) {
    assert.doesNotThrow(() => carrySource(META, odd, ''));                                   // a broken character never stops the other tags
    assert.match(carrySource(META, odd, ''), /&fbclid=ok$/);
  }
  assert.equal(carrySource(META, '?utm_source=meta&utm_source=reddit', ''), `${META}&utm_source=meta`);
  assert.equal(carrySource('https://app.mystockbutler.com/signup?ticker=META&utm_source=old&src=seo-stock', '?utm_source=meta', ''),
    'https://app.mystockbutler.com/signup?ticker=META&utm_source=meta&src=seo-stock', 'a tag the link already had is replaced in place');
});

// The page's inlined script, run against a small fake page: it must do what the module does, keep the first touch in
// sessionStorage for the next page, and survive a browser that refuses storage.
function runPage({ search, links, storage, throwingStorage = false }) {
  const anchors = links.map((href) => ({ attrs: { href }, getAttribute(n) { return this.attrs[n]; }, setAttribute(n, v) { this.attrs[n] = v; } }));
  const listeners = {};
  const sessionStorage = throwingStorage
    ? { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }
    : { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); } };
  const document = {
    readyState: 'loading',
    addEventListener: (n, f) => { listeners[n] = f; },
    querySelectorAll: (sel) => {
      assert.equal(sel, 'a[href^="https://app.mystockbutler.com/signup"]');
      return anchors.filter((a) => a.attrs.href.startsWith('https://app.mystockbutler.com/signup'));
    },
  };
  const script = carrySourceScript();
  assert.match(script, /^<script>[\s\S]*<\/script>\n$/);
  assert.equal((script.match(/<\/script>/g) || []).length, 1);
  vm.runInNewContext(script.replace(/^<script>|<\/script>\n$/g, ''), { document, location: { search }, sessionStorage, URLSearchParams, encodeURIComponent });
  assert.equal(typeof listeners.DOMContentLoaded, 'function', 'the links are rewritten when the page is read');
  assert.deepEqual(anchors.map((a) => a.attrs.href), links, 'nothing changes before then');
  listeners.DOMContentLoaded();
  return anchors.map((a) => a.attrs.href);
}

test('the script on the page rewrites the sign-up links only, keeps the first touch, and never breaks without storage', () => {
  const other = 'https://app.mystockbutler.com/login';
  const storage = {};
  const first = runPage({ search: '?src=meta-promise&utm_source=meta&fbclid=abc', links: [META, FR, other, '/stocks/'], storage });
  assert.deepEqual(first, [
    'https://app.mystockbutler.com/signup?ticker=META&src=meta-promise&utm_source=meta&fbclid=abc',
    'https://app.mystockbutler.com/signup?ticker=TD.TO&src=meta-promise&lang=fr&utm_source=meta&fbclid=abc',
    other, '/stocks/',
  ]);
  assert.equal(storage.msb_first_touch, 'src=meta-promise&utm_source=meta&fbclid=abc');
  // the visitor clicks on to a second page of the blog: no tags in its address, the first touch is carried
  const second = runPage({ search: '', links: [META], storage });
  assert.deepEqual(second, [first[0]]);
  // a later landing with other tags is used for that page but does not replace the first touch
  const third = runPage({ search: '?utm_source=reddit', links: [META], storage });
  assert.deepEqual(third, [`${META}&utm_source=reddit`]);
  assert.equal(storage.msb_first_touch, 'src=meta-promise&utm_source=meta&fbclid=abc');
  // no tags anywhere: nothing is written and no link changes
  const clean = {};
  assert.deepEqual(runPage({ search: '?q=1', links: [META], storage: clean }), [META]);
  assert.deepEqual(clean, {});
  // a browser that refuses storage: the address's tags still go through
  assert.deepEqual(runPage({ search: '?src=meta-promise', links: [META], storage: {}, throwingStorage: true }), ['https://app.mystockbutler.com/signup?ticker=META&src=meta-promise']);
});

test('every generated stock page and hub carries the script once; its sign-up links are unchanged in the HTML', () => {
  const load = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
  const { pages, hubs } = buildStockSite([load('stock-rmd.json'), load('stock-td-to-fr.json')], { today: new Date('2026-10-20T12:00:00Z') });
  assert.ok(pages.some((p) => p.lang === 'fr') && hubs.length > 2);
  for (const p of [...pages, ...hubs]) {
    assert.equal((p.html.match(/function carrySource\(/g) || []).length, 1, p.path);
    assert.equal((p.html.match(/function pickTags\(/g) || []).length, 1, p.path);
  }
  const td = pages.find((p) => p.path === '/stocks/td-to/');
  assert.match(td.html, /href="https:\/\/app\.mystockbutler\.com\/signup\?ticker=TD\.TO&amp;src=seo-stock"/);
  const tdFr = pages.find((p) => p.path === '/fr/stocks/td-to/');
  assert.match(tdFr.html, /signup\?ticker=TD\.TO&amp;src=seo-stock&amp;lang=fr"/);
  assert.match(hubs.find((h) => h.path === '/stocks/').html, /signup\?src=seo-hub"/);
});
