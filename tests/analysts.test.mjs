// SEO row 1 (2026-11-07): the 'analyst recommendations' block (scripts/lib/analysts.mjs): the sentence, the bar's arithmetic,
// the stale guard, the missing file, and the block inside real stock pages in the four languages.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANALYST_WORDS, MAX_AGE_DAYS, MIN_RATINGS, analystView } from '../scripts/lib/analysts.mjs';
import { readAnalysts } from '../scripts/lib/stocksBuild.mjs';
import { buildStockSite } from '../scripts/lib/stocks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = (n) => JSON.parse(readFileSync(path.join(HERE, 'fixtures', n), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const TODAY = new Date('2026-10-30T12:00:00Z');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const at = (b, p) => b.pages.find((x) => x.path === p);

const FILE = (slug, more = {}) => ({
  schema: 'public_analysts_v1', slug, ticker: 'X', symbol: 'X', source: 'FMP', as_of: '2026-10-29T10:00:00Z',
  rating: 'Buy', analysts: 79, counts: { strong_buy: 2, buy: 58, hold: 16, sell: 3, strong_sell: 0 },
  target: { average: 339.17, high: 515, low: 210, median: 325, currency: 'USD' }, price: 186.64,
  estimates: [{ fiscal_year_end: '2027-01-25', eps_avg: 9.29062, eps_analysts: 33, revenue_avg: 4e11, revenue_analysts: 41 },
    { fiscal_year_end: '2028-01-25', eps_avg: 15.80769, eps_analysts: 32, revenue_avg: 6e11, revenue_analysts: 42 }], estimates_currency: 'USD', ...more,
});
const OPT = { today: '2026-10-30', currency: 'USD' };

test('the counts: buy = strong buy + buy, sell = sell + strong sell, hold is what is left, the bar adds to 100', () => {
  const v = analystView(FILE('x'), OPT);
  assert.deepEqual([v.counts.n, v.counts.buy, v.counts.hold, v.counts.sell], [79, 60, 16, 3]);
  assert.equal(v.counts.buy + v.counts.hold + v.counts.sell, v.counts.n);
  assert.ok(Math.abs(v.counts.wBuy + v.counts.wHold + v.counts.wSell - 100) < 0.05);
  assert.equal(v.counts.wBuy, 75.9);
});

test('the gap is arithmetic on the file: 339.17 against 186.64 is +81.7 %; no price, no gap; a target in another currency is not drawn', () => {
  const v = analystView(FILE('x'), OPT);
  assert.ok(Math.abs(v.target.gap - 81.72) < 0.05, String(v.target.gap));
  assert.equal(analystView(FILE('x', { price: undefined }), OPT).target.gap, undefined);
  assert.equal(analystView(FILE('x'), { ...OPT, currency: 'CAD' }).target, undefined);
});

test('the stale guard: as_of more than 14 days before the build day draws nothing; 14 days exactly still draws', () => {
  assert.equal(MAX_AGE_DAYS, 14);
  assert.ok(analystView(FILE('x', { as_of: '2026-10-16T00:00:00Z' }), OPT));
  assert.equal(analystView(FILE('x', { as_of: '2026-10-15T23:00:00Z' }), OPT), null);
  assert.equal(analystView(FILE('x', { as_of: 'last week' }), OPT), null);
  assert.equal(analystView(FILE('x', { source: 'other' }), OPT), null);
  assert.equal(analystView(null, OPT), null);
});

test('thin data: fewer than 5 ratings draw no counts; EPS rows alone draw no block; EPS of a past year is dropped; an inconsistent total is refused', () => {
  assert.equal(MIN_RATINGS, 5);
  const thin = FILE('x', { counts: { strong_buy: 0, buy: 1, hold: 1, sell: 0, strong_sell: 0 }, analysts: 2, target: undefined });
  assert.equal(analystView(thin, OPT), null);                                   // 2 ratings, EPS only: no block
  const t2 = analystView(FILE('x', { counts: thin.counts, analysts: 2 }), OPT);
  assert.equal(t2.counts, undefined);
  assert.ok(t2.target);
  assert.equal(analystView(FILE('x', { analysts: 80 }), OPT).counts, undefined);   // the file's own total disagrees with its counts
  const v = analystView(FILE('x'), { ...OPT, today: '2027-02-01', currency: 'USD' });
  assert.equal(v, null);                                                        // as_of too old for that day
  const w = analystView(FILE('x', { as_of: '2027-01-30T00:00:00Z' }), { ...OPT, today: '2027-02-01' });
  assert.deepEqual(w.eps.rows.map((r) => r.end), ['2028-01-25']);              // the year that ended 2027-01-25 is past
});

test('the sentence in the four languages carries the plan\'s numbers', () => {
  const s = ANALYST_WORDS.en.sentence('NVIDIA', '79', 'November 8, 2026', '60', '16', '3');
  assert.equal(s, 'Of the 79 analysts FMP tracks on November 8, 2026, 60 rate NVIDIA buy or strong buy, 16 hold, 3 sell.');
  for (const lang of ['fr', 'de', 'zh-HK']) {
    assert.deepEqual(Object.keys(ANALYST_WORDS[lang]).sort(), Object.keys(ANALYST_WORDS.en).sort(), lang);
    const t = ANALYST_WORDS[lang].sentence('X', '79', 'D', '60', '16', '3');
    for (const n of ['79', '60', '16', '3']) assert.ok(t.includes(n), `${lang} ${t}`);
  }
  assert.equal(ANALYST_WORDS.de.h('SAP'), 'SAP Analysten-Empfehlungen');
  assert.equal(ANALYST_WORDS.fr.h('Total'), 'Recommandations des analystes sur Total');
  assert.equal(ANALYST_WORDS['zh-HK'].h('騰訊'), '騰訊 分析師評級');
});

test('a missing, unreadable or mismatched file is no analysts (the page stays as it was)', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'an-'));
  try {
    mkdirSync(path.join(root, 'data', 'stocks', 'analysts'), { recursive: true });
    assert.equal(readAnalysts(root, 'nvda'), null);
    writeFileSync(path.join(root, 'data', 'stocks', 'analysts', 'nvda.json'), '{not json');
    assert.equal(readAnalysts(root, 'nvda'), null);
    writeFileSync(path.join(root, 'data', 'stocks', 'analysts', 'nvda.json'), JSON.stringify(FILE('jpm')));
    assert.equal(readAnalysts(root, 'nvda'), null);
    writeFileSync(path.join(root, 'data', 'stocks', 'analysts', 'nvda.json'), JSON.stringify(FILE('nvda')));
    assert.equal(readAnalysts(root, 'nvda').slug, 'nvda');
    assert.equal(readAnalysts(root, '../x'), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the block inside real stock pages: one h1, the H2 and aria-labelledby, FMP named with its date, no advice of ours, title and description unchanged; stale or missing = no block', () => {
  const base = load('stock-nvda-de.json');
  const withFile = (more) => { const d = clone(base); d.analysts = FILE(d.slug, { target: { average: 339.17, high: 515, low: 210, median: 325, currency: d.currency }, ...more }); return d; };
  const off = buildStockSite([clone(base)], { today: TODAY });
  const on = buildStockSite([withFile({})], { today: TODAY });
  const stale = buildStockSite([withFile({ as_of: '2026-09-01T00:00:00Z' })], { today: TODAY });
  let drawn = 0;
  for (const lang of [['en', `/stocks/${base.slug}/`], ['de', `/de/aktien/${base.slug}/`]]) {
    const [l, p] = lang;
    const a = at(on, p), o = at(off, p), s = at(stale, p);
    if (!a || !o) continue;      // the fixture has no page in that language
    drawn += 1;
    assert.match(a.html, /<section class="sec an" aria-labelledby="an-h">\s*<h2 id="an-h">/, l);
    assert.equal((a.html.match(/<h1[ >]/g) || []).length, 1, l);
    assert.match(text(a.html), /Analyst data: FMP, October 29, 2026|Analystendaten: FMP, 29\. Oktober 2026/, l);
    assert.match(text(a.html), /\(calculated\)|\(berechnet\)/, l);
    assert.doesNotMatch(o.html, /id="an-h"/);
    assert.doesNotMatch(s.html, /id="an-h"/);
    assert.equal(/<title>[\s\S]*?<\/title>/.exec(a.html)[0], /<title>[\s\S]*?<\/title>/.exec(o.html)[0]);
    assert.equal(/<meta name="description"[^>]*>/.exec(a.html)[0], /<meta name="description"[^>]*>/.exec(o.html)[0]);
    assert.doesNotMatch(a.html.replace(/<h2 id="an-h">[\s\S]*?<\/h2>/, ''), /\b(we recommend|you should (buy|sell)|wir empfehlen)\b/i);
  }
  assert.ok(drawn >= 1, 'the block was checked on at least one real page');
  console.log('pages checked:', drawn);
});
