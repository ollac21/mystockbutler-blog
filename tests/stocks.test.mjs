// B112: the stock pages and their gate. Real page files (ResMed, TD, cut from the chain's public-pages.json); the gate
// holds back a page with a planted fault and the site keeps no link to it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildStockSite, gatePage, pagePath } from '../scripts/lib/stocks.mjs';

const load = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const TODAY = new Date('2026-10-20T12:00:00Z');

test('the real files build clean: every page passes, no orphan, links to the rival', () => {
  const { pages, hubs, held, report } = buildStockSite([load('stock-rmd.json'), load('stock-td-to.json')], { today: TODAY });
  assert.equal(held.length, 0, JSON.stringify(held));
  assert.equal(report.orphans.length, 0);
  assert.deepEqual(report.deadHubLinks, []);              // the letter list links only letters that have a hub
  assert.ok(pages.length >= 5);
  assert.ok(hubs.some((h) => h.path === '/stocks/'));
  const td = pages.find((p) => p.path === '/stocks/td-to/');
  assert.match(td.html, /<link rel="canonical" href="https:\/\/blog\.mystockbutler\.com\/stocks\/td-to\/">/);
  assert.match(td.html, /signup\?ticker=TD\.TO&amp;src=seo-stock/);
  assert.ok(Buffer.byteLength(td.html) < 100 * 1024);
});

function plantAndBuild(mutate) {
  const rmd = clone(load('stock-rmd.json'));
  mutate(rmd);
  return buildStockSite([rmd, load('stock-td-to.json')], { today: TODAY });
}

test('a number the memo never printed is held back', () => {
  const { held, pages } = plantAndBuild((d) => { d.pages.stock.opening = 'The weighted price is $999.99 in October 2027. It hinges on patients.'; });
  assert.ok(held.some((h) => h.path === '/stocks/rmd/' && h.fails.some((f) => f.includes('999.99'))));
  assert.ok(!pages.some((p) => p.path === '/stocks/rmd/'));
  assert.ok(!pages.some((p) => p.outLinks.includes('/stocks/rmd/')), 'no page links to a held page');
});

test('an advice word is held back', () => {
  const { held } = plantAndBuild((d) => { d.pages.dividend.blocks[0].heading = 'Is ResMed undervalued?'; });
  assert.ok(held.some((h) => h.path === '/stocks/rmd/dividend/' && h.fails.some((f) => f.includes('undervalued'))));
});

test('the paywall: more than 6 memo paragraphs or 3 tables is held back', () => {
  const { held } = plantAndBuild((d) => {
    const b = d.pages.stock.blocks[0];
    d.pages.stock.blocks.push(...[1, 2, 3].map(() => clone(b)));
  });
  assert.ok(held.some((h) => h.path === '/stocks/rmd/' && h.fails.some((f) => /paragraphs|tables/.test(f))));
});

test('a long title, a missing table and no source filing are held back', () => {
  const t = plantAndBuild((d) => { d.pages.earnings.title = 'ResMed earnings date and guidance and everything else you might want'; });
  assert.ok(t.held.some((h) => h.path === '/stocks/rmd/earnings/' && h.fails.some((f) => f.includes('title is'))));
  const e = plantAndBuild((d) => { d.pages.dividend.blocks = d.pages.dividend.blocks.map((b) => ({ ...b, table: null, paragraphs: [] })); });
  assert.ok(e.held.some((h) => h.path === '/stocks/rmd/dividend/'));
  const s = plantAndBuild((d) => { d.sources = []; });
  assert.ok(s.held.some((h) => h.fails.includes('no source filing linked')));
});

test('the gate checks a page as published: canonical, robots, JSON-LD, one h1, question headings', () => {
  const { pages } = buildStockSite([load('stock-rmd.json')], { today: TODAY });
  const p = pages.find((x) => x.path === pagePath('rmd', 'stock'));
  const ctx = { exists: () => true };
  assert.deepEqual(gatePage(p, ctx), []);
  const broken = { ...p, html: p.html.replace('<h1>', '<h1>x</h1><h1>').replace('"@type":"BreadcrumbList"', '"@type":"Nothing"') };
  const fails = gatePage(broken, ctx);
  assert.ok(fails.some((f) => f.includes('h1')) && fails.some((f) => f.includes('BreadcrumbList')));
});
